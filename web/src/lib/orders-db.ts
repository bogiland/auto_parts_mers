import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getSettings, type CheckoutSettings } from "@/lib/checkout-db";
import { audit, maskPhone, normalizePhone, type Staff } from "@/lib/staff-db";
import { conditionLabel } from "@/lib/parts-db";
import { saveImage } from "@/lib/reference-db";
import { parsePhotos, type Photo } from "@/lib/photos";

type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number; lastInsertRowid: number | bigint } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };

const require = createRequire(import.meta.url);
let connection: Database | undefined;

function db(): Database {
  if (connection) return connection;
  getSettings();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const database = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS order_status_history (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL,
      from_status TEXT NOT NULL, to_status TEXT NOT NULL, actor_name TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS order_status_history_order ON order_status_history(order_id, id);
    CREATE TABLE IF NOT EXISTS stock_moves (id INTEGER PRIMARY KEY, product_id TEXT NOT NULL, delta INTEGER NOT NULL,
      reason TEXT NOT NULL, order_id INTEGER, actor_name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      at TEXT NOT NULL, undo_until TEXT, undone INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS stock_moves_product ON stock_moves(product_id, id DESC);
    CREATE TABLE IF NOT EXISTS order_returns (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '', inspection TEXT NOT NULL DEFAULT '', photos_json TEXT NOT NULL DEFAULT '[]',
      decision TEXT NOT NULL, amount_mdl INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT '',
      actor_name TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS order_returns_order ON order_returns(order_id);`);
  for (const column of ["source TEXT NOT NULL DEFAULT 'site'", "delivery_cost_mdl INTEGER NOT NULL DEFAULT 0",
    "notes TEXT NOT NULL DEFAULT ''", "against_advice INTEGER NOT NULL DEFAULT 0", "version INTEGER NOT NULL DEFAULT 1",
    "stock_written INTEGER NOT NULL DEFAULT 0", "cancel_reason TEXT NOT NULL DEFAULT ''", "confirmed_at TEXT",
    "issued_at TEXT", "receipt_token TEXT", "receipt_at TEXT", "receipt_json TEXT", "issue_photos_json TEXT NOT NULL DEFAULT '[]'"]) {
    const name = column.split(" ")[0];
    if (!database.prepare("PRAGMA table_info(orders)").all().some((info) => info.name === name)) database.exec(`ALTER TABLE orders ADD COLUMN ${column}`);
  }
  if (!database.prepare("PRAGMA table_info(catalog_products)").all().some((info) => info.name === "sold_at")) database.exec("ALTER TABLE catalog_products ADD COLUMN sold_at TEXT");
  connection = database;
  return database;
}

const now = () => new Date().toISOString();
const undoWindowMs = 5 * 60 * 1000;

/* ---------- Статусы ---------- */

export const orderStatuses = [
  { id: "received", label: "Новый" },
  { id: "confirmed", label: "Подтверждён" },
  { id: "ready", label: "Готов к выдаче" },
  { id: "shipped", label: "Отправлен" },
  { id: "issued", label: "Выдан" },
  { id: "cancelled", label: "Отменён" },
  { id: "returned", label: "Возврат" },
] as const;

export type OrderStatus = (typeof orderStatuses)[number]["id"];
export const statusLabel = (id: string) => orderStatuses.find((item) => item.id === id)?.label ?? id;

// Другие переходы запрещены: отмена возможна только из незакрытого заказа, возврат — только из выданного.
const transitions: Record<string, OrderStatus[]> = {
  received: ["confirmed", "cancelled"],
  confirmed: ["ready", "shipped", "cancelled"],
  ready: ["issued", "cancelled"],
  shipped: ["issued", "cancelled"],
  issued: ["returned"],
  cancelled: [],
  returned: [],
};
export const nextStatuses = (status: string) => transitions[status] ?? [];
const needsComment: OrderStatus[] = ["cancelled", "returned"];

/* ---------- Чтение ---------- */

export type OrderItem = { productId: string; name: string; sku: string; quantity: number; unitPriceMdl: number; unitPriceRub: number | null; stock: number; returnRestricted: boolean; condition: string };
export type HistoryEntry = { from: string; to: string; actor: string; comment: string; at: string };

export type OrderListRow = {
  id: number; number: number; token: string; status: string; createdAt: string; name: string; phoneMasked: string;
  totalMdl: number; deliveryCostMdl: number; deliveryTitle: string; source: string; summary: string;
  waitingMinutes: number | null; version: number;
};

function minutesWaiting(status: string, createdAt: string) {
  if (status !== "received") return null;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
}

export function listOrderRows(): OrderListRow[] {
  const rows = db().prepare(`SELECT o.*, (SELECT group_concat(name || ' × ' || quantity, ', ') FROM order_items WHERE order_id=o.id) AS summary
    FROM orders o ORDER BY CASE WHEN o.status='received' THEN 0 ELSE 1 END, o.id DESC LIMIT 300`).all();
  return rows.map((row) => ({
    id: Number(row.id), number: Number(row.id) + 1000, token: String(row.token), status: String(row.status),
    createdAt: String(row.created_at), name: String(row.name), phoneMasked: maskPhone(String(row.phone)),
    totalMdl: Number(row.total_mdl), deliveryCostMdl: Number(row.delivery_cost_mdl ?? 0),
    deliveryTitle: String(row.delivery_title), source: String(row.source ?? "site"), summary: String(row.summary ?? ""),
    waitingMinutes: minutesWaiting(String(row.status), String(row.created_at)), version: Number(row.version ?? 1),
  }));
}

export type OrderDetail = OrderListRow & {
  phone: string; address: string; comment: string; notes: string; paymentTitle: string; paymentMethod: string;
  deliveryMethod: string; againstAdvice: boolean; restricted: boolean; items: OrderItem[]; history: HistoryEntry[];
  issuePhotos: Photo[]; receiptToken: string | null; receiptAt: string | null; totalRub: number | null;
  stockWritten: boolean; cancelReason: string; next: OrderStatus[];
};

export function orderDetail(id: number): OrderDetail | null {
  const row = db().prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!row) return null;
  const items = db().prepare(`SELECT i.product_id, i.name, i.quantity, i.unit_price_mdl, i.unit_price_rub,
      COALESCE(p.stock,0) AS stock, COALESCE(p.return_restricted,0) AS return_restricted,
      COALESCE(p.sku,'') AS sku, COALESCE(p.condition,'') AS condition
    FROM order_items i LEFT JOIN catalog_products p ON p.id=i.product_id WHERE i.order_id=? ORDER BY i.name`).all(id)
    .map((item) => ({
      productId: String(item.product_id), name: String(item.name), sku: String(item.sku), quantity: Number(item.quantity),
      unitPriceMdl: Number(item.unit_price_mdl), unitPriceRub: item.unit_price_rub === null ? null : Number(item.unit_price_rub),
      stock: Number(item.stock), returnRestricted: Number(item.return_restricted) === 1, condition: String(item.condition),
    }));
  const history = db().prepare("SELECT from_status,to_status,actor_name,comment,at FROM order_status_history WHERE order_id=? ORDER BY id").all(id)
    .map((entry) => ({ from: String(entry.from_status), to: String(entry.to_status), actor: String(entry.actor_name), comment: String(entry.comment), at: String(entry.at) }));
  const status = String(row.status);
  return {
    id: Number(row.id), number: Number(row.id) + 1000, token: String(row.token), status, createdAt: String(row.created_at),
    name: String(row.name), phoneMasked: maskPhone(String(row.phone)), phone: String(row.phone),
    totalMdl: Number(row.total_mdl), totalRub: row.total_rub === null ? null : Number(row.total_rub),
    deliveryCostMdl: Number(row.delivery_cost_mdl ?? 0), deliveryTitle: String(row.delivery_title),
    deliveryMethod: String(row.delivery_method), paymentTitle: String(row.payment_title), paymentMethod: String(row.payment_method),
    address: String(row.address), comment: String(row.comment), notes: String(row.notes ?? ""),
    source: String(row.source ?? "site"), summary: items.map((item) => `${item.name} × ${item.quantity}`).join(", "),
    againstAdvice: Number(row.against_advice ?? 0) === 1, restricted: items.some((item) => item.returnRestricted),
    items, history, issuePhotos: parsePhotos(row.issue_photos_json),
    receiptToken: (row.receipt_token as string | null) ?? null, receiptAt: (row.receipt_at as string | null) ?? null,
    stockWritten: Number(row.stock_written ?? 0) === 1, cancelReason: String(row.cancel_reason ?? ""),
    waitingMinutes: minutesWaiting(status, String(row.created_at)), version: Number(row.version ?? 1),
    next: nextStatuses(status),
  };
}

/* ---------- Защита от одновременной правки ---------- */

function lockedRow(id: number, version: unknown) {
  const row = db().prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!row) throw new Error("Заказ не найден.");
  const current = Number(row.version ?? 1);
  if (version !== undefined && version !== null && Number(version) !== current) {
    throw new Error("Заказ изменил другой человек, обновите страницу.");
  }
  return row;
}

/* ---------- Движения остатка ---------- */

export type StockMove = { id: number; productId: string; productName: string; delta: number; reason: string; orderId: number | null; actor: string; note: string; at: string; canUndo: boolean };

export const stockReasons: Record<string, string> = {
  order_confirm: "Списано по заказу",
  order_cancel: "Возвращено при отмене заказа",
  order_return: "Возвращено по возврату",
  offline_sale: "Продано офлайн",
  offline_undo: "Отмена офлайн-продажи",
  manual: "Правка остатка вручную",
};

function writeMove(actor: Staff, productId: string, delta: number, reason: string, orderId: number | null, note = "", undoable = false) {
  db().prepare("INSERT INTO stock_moves(product_id,delta,reason,order_id,actor_name,note,at,undo_until,undone) VALUES(?,?,?,?,?,?,?,?,0)")
    .run(productId, delta, reason, orderId, actor.name, note, now(), undoable ? new Date(Date.now() + undoWindowMs).toISOString() : null);
}

export function currentStock(productId: string) {
  const row = db().prepare("SELECT stock FROM catalog_products WHERE id=?").get(productId);
  return row ? Number(row.stock) : null;
}

/** Правка остатка вручную тоже попадает в историю: что, насколько, почему, кто и когда. */
export function recordStockDiff(actor: Staff, productId: string, before: number | null, after: unknown, reason = "manual") {
  const next = Number(after);
  if (before === null || !Number.isSafeInteger(next) || next === before) return;
  writeMove(actor, productId, next - before, reason, null);
}

export function listStockMoves(productId?: string): StockMove[] {
  const where = productId ? "WHERE m.product_id=?" : "";
  const rows = productId
    ? db().prepare(`SELECT m.*, COALESCE(p.name,'') AS product_name FROM stock_moves m LEFT JOIN catalog_products p ON p.id=m.product_id ${where} ORDER BY m.id DESC LIMIT 200`).all(productId)
    : db().prepare("SELECT m.*, COALESCE(p.name,'') AS product_name FROM stock_moves m LEFT JOIN catalog_products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 200").all();
  return rows.map((row) => ({
    id: Number(row.id), productId: String(row.product_id), productName: String(row.product_name), delta: Number(row.delta),
    reason: String(row.reason), orderId: row.order_id === null ? null : Number(row.order_id), actor: String(row.actor_name),
    note: String(row.note), at: String(row.at),
    canUndo: Number(row.undone) === 0 && Boolean(row.undo_until) && new Date(String(row.undo_until)).getTime() > Date.now(),
  }));
}

/** «−1 продано офлайн»: отменить можно в течение пяти минут. */
export function sellOffline(actor: Staff, productId: string) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT name,stock FROM catalog_products WHERE id=?").get(productId);
    if (!row) throw new Error("Деталь не найдена.");
    if (Number(row.stock) < 1) throw new Error("Остаток уже ноль — списывать нечего.");
    database.prepare("UPDATE catalog_products SET stock=stock-1, sold_at=? WHERE id=?").run(now(), productId);
    writeMove(actor, productId, -1, "offline_sale", null, "", true);
    database.exec("COMMIT");
    audit(actor, "Продано офлайн", `${productId}: ${row.name}, остаток ${Number(row.stock) - 1}`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function undoStockMove(actor: Staff, moveId: number) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = database.prepare("SELECT * FROM stock_moves WHERE id=?").get(moveId);
    if (!row) throw new Error("Запись не найдена.");
    if (Number(row.undone) === 1) throw new Error("Эта запись уже отменена.");
    if (!row.undo_until || new Date(String(row.undo_until)).getTime() <= Date.now()) throw new Error("Отменить можно только в течение пяти минут. Поправьте остаток вручную.");
    database.prepare("UPDATE catalog_products SET stock=stock-? WHERE id=?").run(Number(row.delta), String(row.product_id));
    database.prepare("UPDATE stock_moves SET undone=1 WHERE id=?").run(moveId);
    writeMove(actor, String(row.product_id), -Number(row.delta), "offline_undo", null, `Отмена записи № ${moveId}`);
    database.exec("COMMIT");
    audit(actor, "Отмена списания", `Запись № ${moveId}`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/* ---------- Смена статуса ---------- */

export function changeStatus(actor: Staff, id: number, status: string, version: unknown, comment = "") {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const row = lockedRow(id, version);
    const from = String(row.status);
    if (!nextStatuses(from).includes(status as OrderStatus)) throw new Error(`Из «${statusLabel(from)}» нельзя перейти в «${statusLabel(status)}».`);
    const note = comment.trim().slice(0, 500);
    if (needsComment.includes(status as OrderStatus) && note.length < 3) throw new Error("Напишите причину — без неё отмену и возврат не проводим.");
    const items = database.prepare("SELECT product_id, name, quantity FROM order_items WHERE order_id=?").all(id);
    const written = Number(row.stock_written ?? 0) === 1;

    if (status === "confirmed") {
      for (const item of items) {
        const product = database.prepare("SELECT stock,name FROM catalog_products WHERE id=?").get(String(item.product_id));
        const have = product ? Number(product.stock) : 0;
        if (have < Number(item.quantity)) throw new Error(`«${item.name}»: осталось ${have}, в заказе ${item.quantity}.`);
      }
      for (const item of items) {
        database.prepare("UPDATE catalog_products SET stock=stock-?, sold_at=? WHERE id=?").run(Number(item.quantity), now(), String(item.product_id));
        writeMove(actor, String(item.product_id), -Number(item.quantity), "order_confirm", id);
      }
      database.prepare("UPDATE orders SET stock_written=1, confirmed_at=? WHERE id=?").run(now(), id);
    }

    if ((status === "cancelled" || status === "returned") && written) {
      for (const item of items) {
        database.prepare("UPDATE catalog_products SET stock=stock+? WHERE id=?").run(Number(item.quantity), String(item.product_id));
        writeMove(actor, String(item.product_id), Number(item.quantity), status === "cancelled" ? "order_cancel" : "order_return", id);
      }
      database.prepare("UPDATE orders SET stock_written=0 WHERE id=?").run(id);
    }

    if (status === "issued") database.prepare("UPDATE orders SET issued_at=? WHERE id=?").run(now(), id);
    if (status === "cancelled") database.prepare("UPDATE orders SET cancel_reason=? WHERE id=?").run(note, id);
    database.prepare("UPDATE orders SET status=?, version=version+1 WHERE id=?").run(status, id);
    database.prepare("INSERT INTO order_status_history(order_id,from_status,to_status,actor_name,comment,at) VALUES(?,?,?,?,?,?)")
      .run(id, from, status, actor.name, note, now());
    database.exec("COMMIT");
    audit(actor, "Смена статуса заказа", `№ ${id + 1000}: ${statusLabel(from)} → ${statusLabel(status)}${note ? `; ${note}` : ""}`);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/* ---------- Правка карточки ---------- */

export function setDeliveryCost(actor: Staff, id: number, cost: unknown, version: unknown) {
  const value = Number(cost);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new Error("Проверьте стоимость доставки.");
  lockedRow(id, version);
  db().prepare("UPDATE orders SET delivery_cost_mdl=?, version=version+1 WHERE id=?").run(value, id);
  audit(actor, "Стоимость доставки", `№ ${id + 1000}: ${value} L.`);
}

/** Способ получения переключается в карточке: доставка требует адреса. */
export function setDeliveryMethod(actor: Staff, id: number, methodId: unknown, address: unknown, version: unknown) {
  lockedRow(id, version);
  const settings = getSettings();
  const method = settings.deliveryMethods.find((option) => option.id === methodId);
  if (!method) throw new Error("Выберите способ получения.");
  const value = (typeof address === "string" ? address.trim() : "").slice(0, 200);
  if (method.needsAddress && !value) throw new Error("Для доставки нужен адрес.");
  db().prepare("UPDATE orders SET delivery_method=?, delivery_title=?, address=?, version=version+1 WHERE id=?")
    .run(method.id, method.title, method.needsAddress ? value : "", id);
  audit(actor, "Способ получения", `№ ${id + 1000}: ${method.title}`);
}

export function setPaymentMethod(actor: Staff, id: number, methodId: unknown, version: unknown) {
  lockedRow(id, version);
  const method = getSettings().paymentMethods.find((option) => option.id === methodId);
  if (!method) throw new Error("Выберите способ оплаты.");
  db().prepare("UPDATE orders SET payment_method=?, payment_title=?, version=version+1 WHERE id=?").run(method.id, method.title, id);
  audit(actor, "Способ оплаты", `№ ${id + 1000}: ${method.title}`);
}

export function setOrderNotes(actor: Staff, id: number, notes: unknown, version: unknown) {
  lockedRow(id, version);
  const value = typeof notes === "string" ? notes.trim().slice(0, 2000) : "";
  db().prepare("UPDATE orders SET notes=?, version=version+1 WHERE id=?").run(value, id);
  audit(actor, "Заметка по заказу", `№ ${id + 1000}`);
}

export function setAgainstAdvice(actor: Staff, id: number, value: boolean, version: unknown) {
  lockedRow(id, version);
  db().prepare("UPDATE orders SET against_advice=?, version=version+1 WHERE id=?").run(value ? 1 : 0, id);
  audit(actor, value ? "Отмечено: выбор вопреки подборщику" : "Снята отметка о выборе вопреки подборщику", `№ ${id + 1000}`);
}

export function setIssuePhotos(actor: Staff, id: number, photos: unknown, version: unknown) {
  lockedRow(id, version);
  if (!Array.isArray(photos) || photos.length > 6) throw new Error("Можно приложить до 6 фото.");
  const stored = photos.map((item) => {
    const photo = typeof item === "string" ? { src: item, closeup: false } : (item as Photo);
    return { src: saveImage(String(photo?.src ?? ""), 900_000), closeup: Boolean(photo?.closeup) };
  }).filter((photo) => photo.src);
  db().prepare("UPDATE orders SET issue_photos_json=?, version=version+1 WHERE id=?").run(JSON.stringify(stored), id);
  audit(actor, "Фото при выдаче", `№ ${id + 1000}: ${stored.length} фото`);
  return stored;
}

/* ---------- Заказ по телефону ---------- */

export type ClientSummary = { phone: string; phoneMasked: string; name: string; orders: number; lastAt: string };

export function clientList(): ClientSummary[] {
  return db().prepare(`SELECT phone, MAX(name) AS name, COUNT(*) AS orders, MAX(created_at) AS last_at
    FROM orders GROUP BY phone ORDER BY last_at DESC LIMIT 300`).all().map((row) => ({
      phone: String(row.phone), phoneMasked: maskPhone(String(row.phone)), name: String(row.name ?? ""),
      orders: Number(row.orders), lastAt: String(row.last_at),
    }));
}

/** По введённому номеру подтягивается имя клиента из его прошлых заказов. */
export function clientByPhone(phoneInput: string): ClientSummary | null {
  const phone = normalizePhone(phoneInput);
  if (!/^\+\d{8,15}$/.test(phone)) return null;
  const row = db().prepare("SELECT phone, name, COUNT(*) AS orders, MAX(created_at) AS last_at FROM orders WHERE phone=? GROUP BY phone").get(phone);
  if (!row) return null;
  return { phone, phoneMasked: maskPhone(phone), name: String(row.name ?? ""), orders: Number(row.orders), lastAt: String(row.last_at) };
}

export function searchParts(query: string) {
  const text = `%${query.trim().toLowerCase()}%`;
  if (query.trim().length < 2) return [];
  return db().prepare(`SELECT id,name,sku,price_mdl,stock,price_mode FROM catalog_products
    WHERE lower(name) LIKE ? OR lower(COALESCE(sku,'')) LIKE ? ORDER BY name LIMIT 20`).all(text, text).map((row) => ({
      id: String(row.id), name: String(row.name), sku: String(row.sku ?? ""),
      priceMdl: row.price_mdl === null ? null : Number(row.price_mdl), stock: Number(row.stock), priceMode: String(row.price_mode),
    }));
}

export function createCallOrder(actor: Staff, input: Record<string, unknown>) {
  const settings = getSettings();
  const phone = normalizePhone(typeof input.phone === "string" ? input.phone : "");
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error("Проверьте телефон клиента.");
  const name = (typeof input.name === "string" ? input.name.trim() : "").slice(0, 80) || "Клиент по телефону";
  const delivery = settings.deliveryMethods.find((method) => method.id === input.deliveryMethod) ?? settings.deliveryMethods[0];
  const payment = settings.paymentMethods.find((method) => method.id === input.paymentMethod) ?? settings.paymentMethods[0];
  const address = (typeof input.address === "string" ? input.address.trim() : "").slice(0, 200);
  if (delivery.needsAddress && !address) throw new Error("Для доставки нужен адрес.");
  const rows = Array.isArray(input.items) ? input.items : [];
  if (!rows.length || rows.length > 50) throw new Error("Добавьте в заказ хотя бы одну деталь.");

  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const lines: { id: string; name: string; quantity: number; priceMdl: number; priceRub: number | null; cost: number | null }[] = [];
    for (const raw of rows) {
      const item = raw as { id?: unknown; quantity?: unknown };
      const id = typeof item.id === "string" ? item.id : "";
      const quantity = Number(item.quantity ?? 1);
      if (!id || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Проверьте количество деталей.");
      const product = database.prepare("SELECT * FROM catalog_products WHERE id=?").get(id);
      if (!product) throw new Error("Одна из деталей не найдена.");
      if (product.price_mdl === null) throw new Error(`У «${product.name}» нет цены — сначала поставьте цену.`);
      const rate = settings.rubPerMdl;
      lines.push({
        id, name: String(product.name), quantity, priceMdl: Number(product.price_mdl),
        priceRub: product.price_rub !== null ? Number(product.price_rub) : rate !== null && rate > 0 ? Math.round(Number(product.price_mdl) * rate) : null,
        cost: product.cost_mdl === null ? null : Number(product.cost_mdl),
      });
    }
    if (new Set(lines.map((line) => line.id)).size !== lines.length) throw new Error("Одна деталь добавлена дважды.");
    const totalMdl = lines.reduce((sum, line) => sum + line.priceMdl * line.quantity, 0);
    const totalRub = lines.every((line) => line.priceRub !== null) ? lines.reduce((sum, line) => sum + (line.priceRub ?? 0) * line.quantity, 0) : null;
    const token = randomUUID();
    database.prepare(`INSERT INTO orders(idempotency_key,token,name,phone,contact_method,delivery_method,delivery_title,address,
        payment_method,payment_title,comment,total_mdl,total_rub,created_at,source)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'call')`)
      .run(`call-${randomUUID()}`, token, name, phone, "call", delivery.id, delivery.title, address, payment.id, payment.title,
        (typeof input.comment === "string" ? input.comment.trim() : "").slice(0, 500), totalMdl, totalRub, now());
    const created = Number(database.prepare("SELECT id FROM orders WHERE token=?").get(token)?.id);
    const insert = database.prepare("INSERT INTO order_items(order_id,product_id,name,quantity,unit_price_mdl,unit_price_rub,unit_cost_mdl) VALUES(?,?,?,?,?,?,?)");
    for (const line of lines) insert.run(created, line.id, line.name, line.quantity, line.priceMdl, line.priceRub, line.cost);
    database.prepare("INSERT INTO order_status_history(order_id,from_status,to_status,actor_name,comment,at) VALUES(?,?,?,?,?,?)")
      .run(created, "", "received", actor.name, "Заказ принят по телефону", now());
    database.exec("COMMIT");
    audit(actor, "Заказ по телефону", `№ ${created + 1000}: ${lines.length} поз., ${totalMdl} L.`);
    return { id: created, number: created + 1000 };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/* ---------- Возвраты ---------- */

export type ReturnRow = { id: number; orderId: number; orderNumber: number; productId: string; productName: string; inspection: string; photos: Photo[]; decision: string; amountMdl: number; reason: string; actor: string; at: string };

export const returnDecisions = [
  { id: "full", label: "Полный возврат" },
  { id: "partial", label: "Частичный возврат" },
  { id: "refused", label: "Отказ" },
] as const;

export function listReturns(): ReturnRow[] {
  return db().prepare("SELECT * FROM order_returns ORDER BY id DESC LIMIT 200").all().map((row) => ({
    id: Number(row.id), orderId: Number(row.order_id), orderNumber: Number(row.order_id) + 1000,
    productId: String(row.product_id), productName: String(row.product_name), inspection: String(row.inspection),
    photos: parsePhotos(row.photos_json), decision: String(row.decision), amountMdl: Number(row.amount_mdl),
    reason: String(row.reason), actor: String(row.actor_name), at: String(row.at),
  }));
}

export function createReturn(actor: Staff, input: Record<string, unknown>) {
  const orderId = Number(input.orderId);
  if (!Number.isSafeInteger(orderId)) throw new Error("Выберите заказ.");
  const order = orderDetail(orderId);
  if (!order) throw new Error("Заказ не найден.");
  const productId = typeof input.productId === "string" ? input.productId : "";
  const item = order.items.find((line) => line.productId === productId);
  if (!item) throw new Error("Выберите деталь из этого заказа.");
  if (item.returnRestricted) throw new Error(`«${item.name}» возврату не подлежит: двигатели, коробки и агрегаты в сборе не принимаем обратно.`);
  const decision = typeof input.decision === "string" ? input.decision : "";
  if (!returnDecisions.some((option) => option.id === decision)) throw new Error("Выберите решение по возврату.");
  const reason = (typeof input.reason === "string" ? input.reason.trim() : "").slice(0, 500);
  if (reason.length < 3) throw new Error("Напишите причину решения — она останется в истории.");
  const amount = Number(input.amountMdl ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > item.unitPriceMdl * item.quantity) throw new Error("Сумма возврата не может превышать стоимость детали в заказе.");
  if (decision === "refused" && amount !== 0) throw new Error("При отказе сумма возврата — ноль.");
  const photos = Array.isArray(input.photos) ? input.photos.slice(0, 6).map((raw) => {
    const photo = typeof raw === "string" ? { src: raw, closeup: false } : (raw as Photo);
    return { src: saveImage(String(photo?.src ?? ""), 900_000), closeup: Boolean(photo?.closeup) };
  }).filter((photo) => photo.src) : [];
  db().prepare("INSERT INTO order_returns(order_id,product_id,product_name,inspection,photos_json,decision,amount_mdl,reason,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(orderId, productId, item.name, (typeof input.inspection === "string" ? input.inspection.trim() : "").slice(0, 1000), JSON.stringify(photos), decision, amount, reason, actor.name, now());
  audit(actor, "Решение по возврату", `№ ${order.number}: ${item.name} — ${returnDecisions.find((option) => option.id === decision)?.label}, ${amount} L.`);
}

export function returnsOfOrder(orderId: number) {
  return listReturns().filter((row) => row.orderId === orderId);
}

/* ---------- Чек ---------- */

export type ReceiptSnapshot = {
  number: number; createdAt: string; issuedAt: string | null; madeAt: string; madeBy: string;
  header: string; requisites: string; signature: string; warranty: string; invoiceTitle: string; fiscalNumber: string;
  phonePmr: string; phoneMoldova: string; statusUrl: string;
  deliveryTitle: string; paymentTitle: string; address: string;
  clientName: string; clientPhone: string; restricted: boolean; againstAdvice: boolean;
  items: { name: string; sku: string; condition: string; quantity: number; priceMdl: number; priceRub: number | null }[];
  goodsMdl: number; deliveryMdl: number; totalMdl: number; totalRub: number | null; rubPerMdl: number | null;
};

function snapshot(order: OrderDetail, settings: CheckoutSettings, actor: Staff, origin: string): ReceiptSnapshot {
  const goods = order.items.reduce((sum, item) => sum + item.unitPriceMdl * item.quantity, 0);
  const total = goods + order.deliveryCostMdl;
  const rate = settings.rubPerMdl;
  return {
    number: order.number, createdAt: order.createdAt, issuedAt: null, madeAt: now(), madeBy: actor.name,
    header: settings.receipt.header, requisites: settings.receipt.requisites, signature: settings.receipt.signature,
    warranty: settings.receipt.warranty, invoiceTitle: settings.receipt.invoiceTitle, fiscalNumber: settings.receipt.fiscalNumber,
    phonePmr: settings.phones.pmr, phoneMoldova: settings.phones.moldova, statusUrl: `${origin}/order/s/${order.token}`,
    deliveryTitle: order.deliveryTitle, paymentTitle: order.paymentTitle, address: order.address,
    clientName: order.name, clientPhone: order.phone, restricted: order.restricted, againstAdvice: order.againstAdvice,
    items: order.items.map((item) => ({ name: item.name, sku: item.sku, condition: conditionLabel(item.condition), quantity: item.quantity, priceMdl: item.unitPriceMdl, priceRub: item.unitPriceRub })),
    goodsMdl: goods, deliveryMdl: order.deliveryCostMdl, totalMdl: total,
    totalRub: rate !== null && rate > 0 ? Math.round(total * rate) : null, rubPerMdl: rate,
  };
}

/** Чек формируется один раз и хранится в заказе: повторное открытие даёт тот же документ. */
export function buildReceipt(actor: Staff, id: number, version: unknown, origin: string) {
  const row = lockedRow(id, version);
  const order = orderDetail(id)!;
  if (order.status !== "issued") throw new Error("Чек выдаём при выдаче заказа: сначала переведите заказ в «Выдан».");
  const existing = (row.receipt_token as string | null) ?? null;
  if (existing) return { token: existing, created: false };
  const token = randomBytes(16).toString("hex");
  const document = { ...snapshot(order, getSettings(), actor, origin), issuedAt: now() };
  db().prepare("UPDATE orders SET receipt_token=?, receipt_at=?, receipt_json=?, version=version+1 WHERE id=?")
    .run(token, now(), JSON.stringify(document), id);
  audit(actor, "Чек выдан", `№ ${order.number}`);
  return { token, created: true };
}

export function receiptByToken(token: string): ReceiptSnapshot | null {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null;
  const row = db().prepare("SELECT receipt_json FROM orders WHERE receipt_token=?").get(token);
  if (!row?.receipt_json) return null;
  return JSON.parse(String(row.receipt_json)) as ReceiptSnapshot;
}

export function setFiscalNumber(actor: Staff, id: number, value: unknown, version: unknown) {
  const row = lockedRow(id, version);
  const number = (typeof value === "string" ? value.trim() : "").slice(0, 60);
  if (!row.receipt_json) throw new Error("Сначала сформируйте чек.");
  const document = JSON.parse(String(row.receipt_json)) as ReceiptSnapshot;
  db().prepare("UPDATE orders SET receipt_json=?, version=version+1 WHERE id=?").run(JSON.stringify({ ...document, fiscalNumber: number }), id);
  audit(actor, "Номер фискального чека", `№ ${id + 1000}: ${number || "очищен"}`);
}

/* ---------- Сообщение клиенту ---------- */

const money = (value: number) => `${value.toLocaleString("ru-RU")} L.`;

/** Готовый текст для Viber или Telegram: оператор копирует и отправляет. */
export function messageTemplates(order: OrderDetail, settings: CheckoutSettings) {
  const total = order.totalMdl + order.deliveryCostMdl;
  const items = order.items.map((item) => `${item.name} × ${item.quantity}`).join("; ");
  const ru: Record<string, string> = {
    received: `Здравствуйте, ${order.name}! Это NAA.md. Получили ваш заказ № ${order.number}: ${items}. Проверяем наличие и перезвоним с ${settings.operatorHours}.`,
    confirmed: `Здравствуйте, ${order.name}! Заказ № ${order.number} подтверждён: ${items}. Итого ${money(total)}${order.deliveryCostMdl ? ` (из них доставка ${money(order.deliveryCostMdl)})` : ""}. Оплата: ${order.paymentTitle.toLowerCase()}. Получение: ${order.deliveryTitle.toLowerCase()}.`,
    ready: `Здравствуйте, ${order.name}! Заказ № ${order.number} готов к выдаче. ${settings.pickupAddress}, точка работает ${settings.pickupHours}. Итого ${money(total)}.`,
    shipped: `Здравствуйте, ${order.name}! Заказ № ${order.number} отправлен. Как получите — осмотрите деталь и проверьте метки. Итого ${money(total)}.`,
    issued: `Здравствуйте, ${order.name}! Заказ № ${order.number} выдан, спасибо за покупку. Чек и условия возврата — по ссылке в сообщении.`,
    cancelled: `Здравствуйте, ${order.name}! Заказ № ${order.number} отменён. Причина: ${order.cancelReason || "по договорённости"}. Если нужна другая деталь — звоните с ${settings.operatorHours}.`,
    returned: `Здравствуйте, ${order.name}! По заказу № ${order.number} оформлен возврат. Решение и сумму назовёт оператор.`,
  };
  const ro: Record<string, string> = {
    received: `Bună ziua, ${order.name}! Este NAA.md. Am primit comanda nr. ${order.number}: ${items}. Verificăm stocul și vă sunăm între ${settings.operatorHours}.`,
    confirmed: `Bună ziua, ${order.name}! Comanda nr. ${order.number} este confirmată: ${items}. Total ${money(total)}${order.deliveryCostMdl ? ` (din care livrarea ${money(order.deliveryCostMdl)})` : ""}. Plata: ${order.paymentTitle.toLowerCase()}. Primire: ${order.deliveryTitle.toLowerCase()}.`,
    ready: `Bună ziua, ${order.name}! Comanda nr. ${order.number} este pregătită. ${settings.pickupAddress}, punctul lucrează ${settings.pickupHours}. Total ${money(total)}.`,
    shipped: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost expediată. La primire examinați piesa și verificați marcajele. Total ${money(total)}.`,
    issued: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost predată, vă mulțumim. Bonul și condițiile de retur — în linkul din mesaj.`,
    cancelled: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost anulată. Motiv: ${order.cancelReason || "prin înțelegere"}.`,
    returned: `Bună ziua, ${order.name}! Pentru comanda nr. ${order.number} a fost întocmit un retur. Decizia și suma le comunică operatorul.`,
  };
  return { ru: ru[order.status] ?? ru.received, ro: ro[order.status] ?? ro.received };
}

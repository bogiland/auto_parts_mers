import { legacyQuery, transaction } from "@/lib/db";
import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { getSettings, type CheckoutSettings } from "@/lib/checkout-db";
import { audit, maskPhone, phoneVariants, toInternational, type Staff } from "@/lib/staff-db";
import { conditionLabel } from "@/lib/parts-db";
import { savePrivateImage } from "@/lib/reference-db";
import { parsePhotos, type Photo } from "@/lib/photos";
import { clientDiscount, discountedPrice } from "@/lib/client-pricing";

type Row = Record<string, string | number | null>;

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

export async function listOrderRows(): Promise<OrderListRow[]> {
  const rows = (await legacyQuery.all<Row>(`SELECT o.*, (SELECT group_concat(name || ' × ' || quantity, ', ') FROM order_items WHERE order_id=o.id) AS summary
    FROM orders o ORDER BY CASE WHEN o.status='received' THEN 0 ELSE 1 END, o.id DESC LIMIT 300`, []));
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
  deliveryMethod: string; deliveryCostAgreed: boolean; againstAdvice: boolean; restricted: boolean; items: OrderItem[]; history: HistoryEntry[];
  issuePhotos: Photo[]; receiptToken: string | null; receiptAt: string | null; totalRub: number | null;
  stockWritten: boolean; cancelReason: string; next: OrderStatus[];
};

export async function orderDetail(id: number): Promise<OrderDetail | null> {
  const row = (await legacyQuery.get<Row>("SELECT * FROM orders WHERE id=?", [id]));
  if (!row) return null;
  const items = (await legacyQuery.all<Row>(`SELECT i.product_id, i.name, i.quantity, i.unit_price_mdl, i.unit_price_rub,
      COALESCE(p.stock,0) AS stock, COALESCE(p.return_restricted,0) AS return_restricted,
      COALESCE(p.sku,'') AS sku, COALESCE(p.condition,'') AS condition
    FROM order_items i LEFT JOIN catalog_products p ON p.id=i.product_id WHERE i.order_id=? ORDER BY i.name`, [id]))
    .map((item) => ({
      productId: String(item.product_id), name: String(item.name), sku: String(item.sku), quantity: Number(item.quantity),
      unitPriceMdl: Number(item.unit_price_mdl), unitPriceRub: item.unit_price_rub === null ? null : Number(item.unit_price_rub),
      stock: Number(item.stock), returnRestricted: Number(item.return_restricted) === 1, condition: String(item.condition),
    }));
  const history = (await legacyQuery.all<Row>("SELECT from_status,to_status,actor_name,comment,at FROM order_status_history WHERE order_id=? ORDER BY id", [id]))
    .map((entry) => ({ from: String(entry.from_status), to: String(entry.to_status), actor: String(entry.actor_name), comment: String(entry.comment), at: String(entry.at) }));
  const status = String(row.status);
  return {
    id: Number(row.id), number: Number(row.id) + 1000, token: String(row.token), status, createdAt: String(row.created_at),
    name: String(row.name), phoneMasked: maskPhone(String(row.phone)), phone: String(row.phone),
    totalMdl: Number(row.total_mdl), totalRub: row.total_rub === null ? null : Number(row.total_rub),
    deliveryCostMdl: Number(row.delivery_cost_mdl ?? 0), deliveryTitle: String(row.delivery_title),
    deliveryMethod: String(row.delivery_method), deliveryCostAgreed: String(row.delivery_cost_agreed) === 'true' || row.delivery_cost_agreed === 1, paymentTitle: String(row.payment_title), paymentMethod: String(row.payment_method),
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

async function lockedRow(id: number, version: unknown) {
  const row = (await legacyQuery.get<Row>("SELECT * FROM orders WHERE id=? FOR UPDATE", [id]));
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

async function writeMove(actor: Staff, productId: string, delta: number, reason: string, orderId: number | null, note = "", undoable = false) {
return (await transaction(async () => {
  (await legacyQuery.run<Row>("INSERT INTO stock_moves(product_id,delta,reason,order_id,actor_name,note,at,undo_until,undone) VALUES(?,?,?,?,?,?,?,?,0)", [productId, delta, reason, orderId, actor.name, note, now(), undoable ? new Date(Date.now() + undoWindowMs).toISOString() : null]));

}));
}

export async function currentStock(productId: string) {
  const row = (await legacyQuery.get<Row>("SELECT stock FROM catalog_products WHERE id=?", [productId]));
  return row ? Number(row.stock) : null;
}

/** Правка остатка вручную тоже попадает в историю: что, насколько, почему, кто и когда. */
export async function recordStockDiff(actor: Staff, productId: string, before: number | null, after: unknown, reason = "manual") {
return (await transaction(async () => {
  const next = Number(after);
  if (before === null || !Number.isSafeInteger(next) || next === before) return;
  (await writeMove(actor, productId, next - before, reason, null));

}));
}

export async function listStockMoves(productId?: string): Promise<StockMove[]> {
  const where = productId ? "WHERE m.product_id=?" : "";
  const rows = productId
    ? (await legacyQuery.all<Row>(`SELECT m.*, COALESCE(p.name,'') AS product_name FROM stock_moves m LEFT JOIN catalog_products p ON p.id=m.product_id ${where} ORDER BY m.id DESC LIMIT 200`, [productId]))
    : (await legacyQuery.all<Row>("SELECT m.*, COALESCE(p.name,'') AS product_name FROM stock_moves m LEFT JOIN catalog_products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 200", []));
  return rows.map((row) => ({
    id: Number(row.id), productId: String(row.product_id), productName: String(row.product_name), delta: Number(row.delta),
    reason: String(row.reason), orderId: row.order_id === null ? null : Number(row.order_id), actor: String(row.actor_name),
    note: String(row.note), at: String(row.at),
    canUndo: Number(row.undone) === 0 && Boolean(row.undo_until) && new Date(String(row.undo_until)).getTime() > Date.now(),
  }));
}

/** «−1 продано офлайн»: отменить можно в течение пяти минут. */
export async function sellOffline(actor: Staff, productId: string) {
return (await transaction(async () => {
  
  
  try {
    const row = (await legacyQuery.get<Row>("SELECT name,stock FROM catalog_products WHERE id=? FOR UPDATE", [productId]));
    if (!row) throw new Error("Деталь не найдена.");
    if (Number(row.stock) < 1) throw new Error("Остаток уже ноль — списывать нечего.");
    (await legacyQuery.run<Row>("UPDATE catalog_products SET stock=stock-1, sold_at=? WHERE id=?", [now(), productId]));
    (await writeMove(actor, productId, -1, "offline_sale", null, "", true));
    
    (await audit(actor, "Продано офлайн", `${productId}: ${row.name}, остаток ${Number(row.stock) - 1}`));
  } catch (error) {
    
    throw error;
  }

}));
}

export async function undoStockMove(actor: Staff, moveId: number) {
return (await transaction(async () => {
  
  
  try {
    const row = (await legacyQuery.get<Row>("SELECT * FROM stock_moves WHERE id=? FOR UPDATE", [moveId]));
    if (!row) throw new Error("Запись не найдена.");
    if (Number(row.undone) === 1) throw new Error("Эта запись уже отменена.");
    if (!row.undo_until || new Date(String(row.undo_until)).getTime() <= Date.now()) throw new Error("Отменить можно только в течение пяти минут. Поправьте остаток вручную.");
    (await legacyQuery.run<Row>("UPDATE catalog_products SET stock=stock-? WHERE id=?", [Number(row.delta), String(row.product_id)]));
    (await legacyQuery.run<Row>("UPDATE stock_moves SET undone=1 WHERE id=?", [moveId]));
    (await writeMove(actor, String(row.product_id), -Number(row.delta), "offline_undo", null, `Отмена записи № ${moveId}`));
    
    (await audit(actor, "Отмена списания", `Запись № ${moveId}`));
  } catch (error) {
    
    throw error;
  }

}));
}

/* ---------- Смена статуса ---------- */

export async function changeStatus(actor: Staff, id: number, status: string, version: unknown, comment = "") {
return (await transaction(async () => {
  
  
  try {
    const row = (await lockedRow(id, version));
    const from = String(row.status);
    if (!nextStatuses(from).includes(status as OrderStatus)) throw new Error(`Из «${statusLabel(from)}» нельзя перейти в «${statusLabel(status)}».`);
    const note = comment.trim().slice(0, 500);
    if (needsComment.includes(status as OrderStatus) && note.length < 3) throw new Error("Напишите причину — без неё отмену и возврат не проводим.");
    const items = (await legacyQuery.all<Row>("SELECT product_id, name, quantity FROM order_items WHERE order_id=?", [id]));
    const written = Number(row.stock_written ?? 0) === 1;

    if (status === "confirmed") {
      for (const item of items) {
        const product = (await legacyQuery.get<Row>("SELECT stock,name FROM catalog_products WHERE id=? FOR UPDATE", [String(item.product_id)]));
        const have = product ? Number(product.stock) : 0;
        if (have < Number(item.quantity)) throw new Error(`«${item.name}»: осталось ${have}, в заказе ${item.quantity}.`);
      }
      for (const item of items) {
        (await legacyQuery.run<Row>("UPDATE catalog_products SET stock=stock-?, sold_at=? WHERE id=?", [Number(item.quantity), now(), String(item.product_id)]));
        (await writeMove(actor, String(item.product_id), -Number(item.quantity), "order_confirm", id));
      }
      (await legacyQuery.run<Row>("UPDATE orders SET stock_written=1, confirmed_at=? WHERE id=?", [now(), id]));
    }

    if ((status === "cancelled" || status === "returned") && written) {
      for (const item of items) {
        (await legacyQuery.run<Row>("UPDATE catalog_products SET stock=stock+? WHERE id=?", [Number(item.quantity), String(item.product_id)]));
        (await writeMove(actor, String(item.product_id), Number(item.quantity), status === "cancelled" ? "order_cancel" : "order_return", id));
      }
      (await legacyQuery.run<Row>("UPDATE orders SET stock_written=0 WHERE id=?", [id]));
    }

    if (status === "issued") (await legacyQuery.run<Row>("UPDATE orders SET issued_at=? WHERE id=?", [now(), id]));
    if (status === "cancelled") (await legacyQuery.run<Row>("UPDATE orders SET cancel_reason=? WHERE id=?", [note, id]));
    (await legacyQuery.run<Row>("UPDATE orders SET status=?, version=version+1 WHERE id=?", [status, id]));
    (await legacyQuery.run<Row>("INSERT INTO order_status_history(order_id,from_status,to_status,actor_name,comment,at) VALUES(?,?,?,?,?,?)", [id, from, status, actor.name, note, now()]));
    
    (await audit(actor, "Смена статуса заказа", `№ ${id + 1000}: ${statusLabel(from)} → ${statusLabel(status)}${note ? `; ${note}` : ""}`));
  } catch (error) {
    
    throw error;
  }

}));
}

/* ---------- Правка карточки ---------- */

export async function setDeliveryCost(actor: Staff, id: number, cost: unknown, version: unknown) {
return (await transaction(async () => {
  const value = Number(cost);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new Error("Проверьте стоимость доставки.");
  (await lockedRow(id, version));
  (await legacyQuery.run<Row>("UPDATE orders SET delivery_cost_mdl=?, delivery_cost_agreed=true, version=version+1 WHERE id=?", [value, id]));
  (await audit(actor, "Стоимость доставки", `№ ${id + 1000}: ${value} руб.`));

}));
}

/** Способ получения переключается в карточке: доставка требует адреса. */
export async function setDeliveryMethod(actor: Staff, id: number, methodId: unknown, address: unknown, version: unknown) {
return (await transaction(async () => {
  (await lockedRow(id, version));
  const settings = (await getSettings());
  const method = settings.deliveryMethods.find((option) => option.id === methodId);
  if (!method) throw new Error("Выберите способ получения.");
  const value = (typeof address === "string" ? address.trim() : "").slice(0, 200);
  if (method.needsAddress && !value) throw new Error("Для доставки нужен адрес.");
  (await legacyQuery.run<Row>("UPDATE orders SET delivery_method=?, delivery_title=?, address=?, delivery_cost_agreed=CASE WHEN delivery_method=? THEN delivery_cost_agreed ELSE NULL END, version=version+1 WHERE id=?", [method.id, method.title, method.needsAddress ? value : "", method.id, id]));
  (await audit(actor, "Способ получения", `№ ${id + 1000}: ${method.title}`));

}));
}

export async function setPaymentMethod(actor: Staff, id: number, methodId: unknown, version: unknown) {
return (await transaction(async () => {
  (await lockedRow(id, version));
  const method = (await getSettings()).paymentMethods.find((option) => option.id === methodId);
  if (!method) throw new Error("Выберите способ оплаты.");
  (await legacyQuery.run<Row>("UPDATE orders SET payment_method=?, payment_title=?, version=version+1 WHERE id=?", [method.id, method.title, id]));
  (await audit(actor, "Способ оплаты", `№ ${id + 1000}: ${method.title}`));

}));
}

export async function setOrderNotes(actor: Staff, id: number, notes: unknown, version: unknown) {
return (await transaction(async () => {
  (await lockedRow(id, version));
  const value = typeof notes === "string" ? notes.trim().slice(0, 2000) : "";
  (await legacyQuery.run<Row>("UPDATE orders SET notes=?, version=version+1 WHERE id=?", [value, id]));
  (await audit(actor, "Заметка по заказу", `№ ${id + 1000}`));

}));
}

export async function setAgainstAdvice(actor: Staff, id: number, value: boolean, version: unknown) {
return (await transaction(async () => {
  (await lockedRow(id, version));
  (await legacyQuery.run<Row>("UPDATE orders SET against_advice=?, version=version+1 WHERE id=?", [value ? 1 : 0, id]));
  (await audit(actor, value ? "Отмечено: выбор вопреки подборщику" : "Снята отметка о выборе вопреки подборщику", `№ ${id + 1000}`));

}));
}

export async function setIssuePhotos(actor: Staff, id: number, photos: unknown, version: unknown) {
return (await transaction(async () => {
  (await lockedRow(id, version));
  if (!Array.isArray(photos) || photos.length > 6) throw new Error("Можно приложить до 6 фото.");
  const stored = (await Promise.all(photos.map(async (item) => {
    const photo = typeof item === "string" ? { src: item, closeup: false } : (item as Photo);
    return { src: await savePrivateImage(String(photo?.src ?? ""), 900_000), closeup: Boolean(photo?.closeup) };
  }))).filter((photo) => photo.src);
  (await legacyQuery.run<Row>("UPDATE orders SET issue_photos_json=?, version=version+1 WHERE id=?", [JSON.stringify(stored), id]));
  (await audit(actor, "Фото при выдаче", `№ ${id + 1000}: ${stored.length} фото`));
  return stored;

}));
}

/* ---------- Заказ по телефону ---------- */

export type ClientSummary = { phone: string; phoneMasked: string; name: string; orders: number; lastAt: string };

export async function clientList(): Promise<ClientSummary[]> {
  return (await legacyQuery.all<Row>(`SELECT phone, MAX(name) AS name, COUNT(*) AS orders, MAX(created_at) AS last_at
    FROM orders GROUP BY phone ORDER BY last_at DESC LIMIT 300`, [])).map((row) => ({
      phone: String(row.phone), phoneMasked: maskPhone(String(row.phone)), name: String(row.name ?? ""),
      orders: Number(row.orders), lastAt: String(row.last_at),
    }));
}

/** По введённому номеру подтягивается имя клиента из его прошлых заказов — хоть 060..., хоть +373... */
export async function clientByPhone(phoneInput: string): Promise<ClientSummary | null> {
  const candidates = phoneVariants(phoneInput).filter(Boolean);
  if (!candidates.length) return null;
  const placeholders = candidates.map(() => "?").join(",");
  const row = (await legacyQuery.get<Row>(`SELECT phone, name, COUNT(*) AS orders, MAX(created_at) AS last_at FROM orders WHERE phone IN (${placeholders}) GROUP BY phone ORDER BY last_at DESC`, [...candidates]));
  if (!row) return null;
  const phone = String(row.phone);
  return { phone, phoneMasked: maskPhone(phone), name: String(row.name ?? ""), orders: Number(row.orders), lastAt: String(row.last_at) };
}

export async function searchParts(query: string) {
  const text = `%${query.trim().toLowerCase()}%`;
  if (query.trim().length < 2) return [];
  return (await legacyQuery.all<Row>(`SELECT id,name,sku,price_mdl,stock,price_mode FROM catalog_products
    WHERE lower(name) LIKE ? OR lower(COALESCE(sku,'')) LIKE ? ORDER BY name LIMIT 20`, [text, text])).map((row) => ({
      id: String(row.id), name: String(row.name), sku: String(row.sku ?? ""),
      priceMdl: row.price_mdl === null ? null : Number(row.price_mdl), stock: Number(row.stock), priceMode: String(row.price_mode),
    }));
}

export async function createCallOrder(actor: Staff, input: Record<string, unknown>) {
return (await transaction(async () => {
  const settings = (await getSettings());
  // Оператор диктует номер как слышит: 060 000 911 сохранится как +37360000911.
  const phone = toInternational(typeof input.phone === "string" ? input.phone : "");
  const discount = await clientDiscount(phone);
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error("Проверьте телефон клиента.");
  const name = (typeof input.name === "string" ? input.name.trim() : "").slice(0, 80) || "Клиент по телефону";
  const delivery = settings.deliveryMethods.find((method) => method.id === input.deliveryMethod) ?? settings.deliveryMethods[0];
  const payment = settings.paymentMethods.find((method) => method.id === input.paymentMethod) ?? settings.paymentMethods[0];
  const address = (typeof input.address === "string" ? input.address.trim() : "").slice(0, 200);
  if (delivery.needsAddress && !address) throw new Error("Для доставки нужен адрес.");
  const rows = Array.isArray(input.items) ? input.items : [];
  if (!rows.length || rows.length > 50) throw new Error("Добавьте в заказ хотя бы одну деталь.");

  
  
  try {
    const lines: { id: string; name: string; quantity: number; priceMdl: number; priceRub: number | null; cost: number | null }[] = [];
    for (const raw of rows) {
      const item = raw as { id?: unknown; quantity?: unknown };
      const id = typeof item.id === "string" ? item.id : "";
      const quantity = Number(item.quantity ?? 1);
      if (!id || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Проверьте количество деталей.");
      const product = (await legacyQuery.get<Row>("SELECT * FROM catalog_products WHERE id=?", [id]));
      if (!product) throw new Error("Одна из деталей не найдена.");
      if (product.price_mdl === null) throw new Error(`У «${product.name}» нет цены — сначала поставьте цену.`);
      lines.push({
        id, name: String(product.name), quantity, priceMdl: discountedPrice(Number(product.price_mdl),discount),
        priceRub: null,
        cost: product.cost_mdl === null ? null : Number(product.cost_mdl),
      });
    }
    if (new Set(lines.map((line) => line.id)).size !== lines.length) throw new Error("Одна деталь добавлена дважды.");
    const totalMdl = lines.reduce((sum, line) => sum + line.priceMdl * line.quantity, 0);
    const totalRub = lines.every((line) => line.priceRub !== null) ? lines.reduce((sum, line) => sum + (line.priceRub ?? 0) * line.quantity, 0) : null;
    const token = randomUUID();
    (await legacyQuery.run<Row>(`INSERT INTO orders(idempotency_key,token,name,phone,contact_method,delivery_method,delivery_title,address,
        payment_method,payment_title,comment,total_mdl,total_rub,created_at,source)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'call')`, [`call-${randomUUID()}`, token, name, phone, "call", delivery.id, delivery.title, address, payment.id, payment.title, (typeof input.comment === "string" ? input.comment.trim() : "").slice(0, 500), totalMdl, totalRub, now()]));
    const created = Number((await legacyQuery.get<Row>("SELECT id FROM orders WHERE token=?", [token]))?.id);
    for (const line of lines) await legacyQuery.run<Row>("INSERT INTO order_items(order_id,product_id,name,quantity,unit_price_mdl,unit_price_rub,unit_cost_mdl) VALUES(?,?,?,?,?,?,?)", [created, line.id, line.name, line.quantity, line.priceMdl, line.priceRub, line.cost]);
    (await legacyQuery.run<Row>("INSERT INTO order_status_history(order_id,from_status,to_status,actor_name,comment,at) VALUES(?,?,?,?,?,?)", [created, "", "received", actor.name, "Заказ принят по телефону", now()]));
    
    (await audit(actor, "Заказ по телефону", `№ ${created + 1000}: ${lines.length} поз., ${totalMdl} руб.`));
    return { id: created, number: created + 1000 };
  } catch (error) {
    
    throw error;
  }

}));
}

/* ---------- Возвраты ---------- */

export type ReturnRow = { id: number; orderId: number; orderNumber: number; productId: string; productName: string; inspection: string; photos: Photo[]; decision: string; amountMdl: number; reason: string; actor: string; at: string };

export const returnDecisions = [
  { id: "full", label: "Полный возврат" },
  { id: "partial", label: "Частичный возврат" },
  { id: "refused", label: "Отказ" },
] as const;

export async function listReturns(): Promise<ReturnRow[]> {
  return (await legacyQuery.all<Row>("SELECT * FROM order_returns ORDER BY id DESC LIMIT 200", [])).map((row) => ({
    id: Number(row.id), orderId: Number(row.order_id), orderNumber: Number(row.order_id) + 1000,
    productId: String(row.product_id), productName: String(row.product_name), inspection: String(row.inspection),
    photos: parsePhotos(row.photos_json), decision: String(row.decision), amountMdl: Number(row.amount_mdl),
    reason: String(row.reason), actor: String(row.actor_name), at: String(row.at),
  }));
}

export async function createReturn(actor: Staff, input: Record<string, unknown>) {
return (await transaction(async () => {
  const orderId = Number(input.orderId);
  if (!Number.isSafeInteger(orderId)) throw new Error("Выберите заказ.");
  const order = (await orderDetail(orderId));
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
  const photos = Array.isArray(input.photos) ? (await Promise.all(input.photos.slice(0, 6).map(async (raw) => {
    const photo = typeof raw === "string" ? { src: raw, closeup: false } : (raw as Photo);
    return { src: await savePrivateImage(String(photo?.src ?? ""), 900_000), closeup: Boolean(photo?.closeup) };
  }))).filter((photo) => photo.src) : [];
  (await legacyQuery.run<Row>("INSERT INTO order_returns(order_id,product_id,product_name,inspection,photos_json,decision,amount_mdl,reason,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?)", [orderId, productId, item.name, (typeof input.inspection === "string" ? input.inspection.trim() : "").slice(0, 1000), JSON.stringify(photos), decision, amount, reason, actor.name, now()]));
  (await audit(actor, "Решение по возврату", `№ ${order.number}: ${item.name} — ${returnDecisions.find((option) => option.id === decision)?.label}, ${amount} руб.`));

}));
}

export async function returnsOfOrder(orderId: number) {
  return (await listReturns()).filter((row) => row.orderId === orderId);
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
export async function buildReceipt(actor: Staff, id: number, version: unknown, origin: string) {
return (await transaction(async () => {
  const row = (await lockedRow(id, version));
  const order = (await orderDetail(id))!;
  if (order.status !== "issued") throw new Error("Чек выдаём при выдаче заказа: сначала переведите заказ в «Выдан».");
  const existing = (row.receipt_token as string | null) ?? null;
  if (existing) return { token: existing, created: false };
  const token = randomBytes(16).toString("hex");
  const settings = await getSettings();
  const document = { ...snapshot(order, settings, actor, origin), issuedAt: now() };
  // Ссылка на чек живёт ограниченный срок: документ остаётся в заказе навсегда,
  // но публичный адрес перестаёт открываться и его можно отозвать раньше.
  const expires = new Date(Date.now() + receiptLinkDays(settings) * 24 * 60 * 60 * 1000).toISOString();
  (await legacyQuery.run<Row>("UPDATE orders SET receipt_token=?, receipt_at=?, receipt_json=?, receipt_expires_at=?, receipt_revoked=0, version=version+1 WHERE id=?", [token, now(), JSON.stringify(document), expires, id]));
  (await audit(actor, "Чек выдан", `№ ${order.number}`));
  return { token, created: true, expiresAt: expires };

}));
}

function receiptLinkDays(settings: CheckoutSettings) {
  const value = Number((settings.receipt as { linkDays?: unknown }).linkDays);
  return Number.isSafeInteger(value) && value > 0 && value <= 365 ? value : 30;
}

export type ReceiptAccess = { receipt: ReceiptSnapshot; orderId: number; customerId: number | null; expiresAt: string | null };

/**
 * Чек по публичной ссылке. Просроченная и отозванная ссылка не открывается вовсе.
 * Персональные данные здесь ещё не скрыты — это делает страница, по тому,
 * кто смотрит: сотрудник, владелец кабинета или посторонний с ссылкой.
 */
export async function receiptByToken(token: string): Promise<ReceiptAccess | null> {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null;
  const row = (await legacyQuery.get<Row>("SELECT id, customer_id, receipt_json, receipt_expires_at, receipt_revoked FROM orders WHERE receipt_token=?", [token]));
  if (!row?.receipt_json) return null;
  if (Number(row.receipt_revoked ?? 0) === 1) return null;
  const expiresAt = (row.receipt_expires_at as string | null) ?? null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return null;
  return {
    receipt: JSON.parse(String(row.receipt_json)) as ReceiptSnapshot,
    orderId: Number(row.id),
    customerId: row.customer_id === null ? null : Number(row.customer_id),
    expiresAt,
  };
}

/** Гостю по ссылке достаётся документ без имени, телефона и адреса. */
export function maskReceipt(receipt: ReceiptSnapshot): ReceiptSnapshot {
  return { ...receipt, clientName: "Покупатель", clientPhone: maskPhone(receipt.clientPhone), address: "" };
}

/** Ссылку можно отозвать: адрес перестаёт открываться, сам чек в заказе остаётся. */
export async function revokeReceipt(actor: Staff, id: number, version: unknown) {
return (await transaction(async () => {
  const row = (await lockedRow(id, version));
  if (!row.receipt_token) throw new Error("Чек ещё не сформирован.");
  (await legacyQuery.run<Row>("UPDATE orders SET receipt_revoked=1, version=version+1 WHERE id=?", [id]));
  (await audit(actor, "Ссылка на чек отозвана", `№ ${id + 1000}`));

}));
}

export async function setFiscalNumber(actor: Staff, id: number, value: unknown, version: unknown) {
return (await transaction(async () => {
  const row = (await lockedRow(id, version));
  const number = (typeof value === "string" ? value.trim() : "").slice(0, 60);
  if (!row.receipt_json) throw new Error("Сначала сформируйте чек.");
  const document = JSON.parse(String(row.receipt_json)) as ReceiptSnapshot;
  (await legacyQuery.run<Row>("UPDATE orders SET receipt_json=?, version=version+1 WHERE id=?", [JSON.stringify({ ...document, fiscalNumber: number }), id]));
  (await audit(actor, "Номер фискального чека", `№ ${id + 1000}: ${number || "очищен"}`));

}));
}

/* ---------- Сообщение клиенту ---------- */

const money = (value: number) => `${value.toLocaleString("ru-RU")} руб.`;

/** Готовый текст для Viber или Telegram: оператор копирует и отправляет. */
export function messageTemplates(order: OrderDetail, settings: CheckoutSettings) {
  const total = order.totalMdl + order.deliveryCostMdl;
  const items = order.items.map((item) => `${item.name} × ${item.quantity}`).join("; ");
  const totalRu = order.deliveryCostAgreed ? `Итого ${money(total)}` : `Детали ${money(order.totalMdl)}, стоимость доставки уточняется`;
  const totalRo = order.deliveryCostAgreed ? `Total ${money(total)}` : `Piese ${money(order.totalMdl)}, costul livrării urmează să fie confirmat`;
  const ru: Record<string, string> = {
    received: `Здравствуйте, ${order.name}! Это NAA.md. Получили ваш заказ № ${order.number}: ${items}. Проверяем наличие и перезвоним с ${settings.operatorHours}.`,
    confirmed: `Здравствуйте, ${order.name}! Заказ № ${order.number} подтверждён: ${items}. ${totalRu}. Оплата: ${order.paymentTitle.toLowerCase()}. Получение: ${order.deliveryTitle.toLowerCase()}.`,
    ready: `Здравствуйте, ${order.name}! Заказ № ${order.number} готов к выдаче. ${settings.pickupAddress}, точка работает ${settings.pickupHours}. Итого ${money(total)}.`,
    shipped: `Здравствуйте, ${order.name}! Заказ № ${order.number} отправлен. Как получите — осмотрите деталь и проверьте метки. Итого ${money(total)}.`,
    issued: `Здравствуйте, ${order.name}! Заказ № ${order.number} выдан, спасибо за покупку. Чек и условия возврата — по ссылке в сообщении.`,
    cancelled: `Здравствуйте, ${order.name}! Заказ № ${order.number} отменён. Причина: ${order.cancelReason || "по договорённости"}. Если нужна другая деталь — звоните с ${settings.operatorHours}.`,
    returned: `Здравствуйте, ${order.name}! По заказу № ${order.number} оформлен возврат. Решение и сумму назовёт оператор.`,
  };
  const ro: Record<string, string> = {
    received: `Bună ziua, ${order.name}! Este NAA.md. Am primit comanda nr. ${order.number}: ${items}. Verificăm stocul și vă sunăm între ${settings.operatorHours}.`,
    confirmed: `Bună ziua, ${order.name}! Comanda nr. ${order.number} este confirmată: ${items}. ${totalRo}. Plata: ${order.paymentTitle.toLowerCase()}. Primire: ${order.deliveryTitle.toLowerCase()}.`,
    ready: `Bună ziua, ${order.name}! Comanda nr. ${order.number} este pregătită. ${settings.pickupAddress}, punctul lucrează ${settings.pickupHours}. Total ${money(total)}.`,
    shipped: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost expediată. La primire examinați piesa și verificați marcajele. Total ${money(total)}.`,
    issued: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost predată, vă mulțumim. Bonul și condițiile de retur — în linkul din mesaj.`,
    cancelled: `Bună ziua, ${order.name}! Comanda nr. ${order.number} a fost anulată. Motiv: ${order.cancelReason || "prin înțelegere"}.`,
    returned: `Bună ziua, ${order.name}! Pentru comanda nr. ${order.number} a fost întocmit un retur. Decizia și suma le comunică operatorul.`,
  };
  return { ru: ru[order.status] ?? ru.received, ro: ro[order.status] ?? ro.received };
}

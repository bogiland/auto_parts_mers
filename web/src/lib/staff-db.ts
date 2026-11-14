import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getCheckoutCatalog, getSettings } from "@/lib/checkout-db";

export type Role = "owner" | "operator";
export type Staff = { id: number; phone: string; role: Role; name: string };
type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number; lastInsertRowid: number | bigint } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };
const require = createRequire(import.meta.url);
const idleMs = 2 * 60 * 60 * 1000;
let connection: Database | undefined;

function db(): Database {
  if (connection) return connection;
  getCheckoutCatalog();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  connection = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS staff_users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','operator')), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS staff_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES staff_users(id), last_seen INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY, phone TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS login_attempts_at ON login_attempts(at);
    CREATE TABLE IF NOT EXISTS staff_audit (id INTEGER PRIMARY KEY, actor_id INTEGER, actor_name TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS staff_audit_at ON staff_audit(at DESC);
    CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY, phone TEXT NOT NULL, part TEXT NOT NULL, vehicle TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('expert','catalog')), status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries(created_at DESC);`);
  if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((column) => column.name === "cost_mdl")) connection.exec("ALTER TABLE catalog_products ADD COLUMN cost_mdl INTEGER");
  if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((column) => column.name === "photos_json")) connection.exec("ALTER TABLE catalog_products ADD COLUMN photos_json TEXT NOT NULL DEFAULT '[]'");
  for (const column of ["category_id TEXT", "part_type_id TEXT", "model_id TEXT"]) {
    const name = column.split(" ")[0];
    if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((info) => info.name === name)) connection.exec(`ALTER TABLE catalog_products ADD COLUMN ${column}`);
  }
  return connection;
}

export function normalizePhone(value: string) { return value.replace(/[\s()\-]/g, ""); }

/** Сотрудник набирает номер как привык: 77745636, 077745636 или +373 777 45 636 — это один и тот же человек. */
export function phoneVariants(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  const found = new Set<string>();
  const plain = normalizePhone(value);
  if (plain) found.add(plain);
  if (digits) {
    found.add(`+${digits}`);
    if (!digits.startsWith("373")) found.add(`+373${digits.replace(/^0+/, "")}`);
    else found.add(`+${digits}`);
  }
  return [...found];
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 64), Buffer.from(hash, "hex"));
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function audit(actor: Staff | null, action: string, details = "") {
  db().prepare("INSERT INTO staff_audit(actor_id,actor_name,action,details,at) VALUES(?,?,?,?,?)")
    .run(actor?.id ?? null, actor?.name ?? "Система", action, details, new Date().toISOString());
}

export function login(phoneInput: string, password: string): { staff: Staff; token: string } | null {
  const candidates = phoneVariants(phoneInput);
  const phone = candidates[0] ?? "";
  const now = Date.now();
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM login_attempts WHERE at<?").run(now - 60_000);
    const attempts = Number(database.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE phone=?").get(phone)?.count ?? 0);
    const globalAttempts = Number(database.prepare("SELECT COUNT(*) AS count FROM login_attempts").get()?.count ?? 0);
    if (attempts >= 5 || globalAttempts >= 30) { database.exec("COMMIT"); return null; }
    database.prepare("INSERT INTO login_attempts(phone,at) VALUES(?,?)").run(phone, now);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  const placeholders = candidates.map(() => "?").join(",");
  const row = database.prepare(`SELECT * FROM staff_users WHERE phone IN (${placeholders}) AND active=1`).get(...candidates);
  // The same expensive operation runs for unknown users, so responses reveal less about accounts.
  if (!verifyPassword(password, String(row?.password_hash ?? dummyHash))) return null;
  if (!row) return null;
  const staff = toStaff(row);
  const token = randomBytes(32).toString("hex");
  database.prepare("INSERT INTO staff_sessions(token_hash,user_id,last_seen) VALUES(?,?,?)").run(tokenHash(token), staff.id, now);
  audit(staff, "Вход");
  return { staff, token };
}

const dummyHash = "00000000000000000000000000000000:5b82ab929e21a911f34a948acc6a287ce3bb61734d92b0699fd4c4a2bba57371b91c6a4c192427b0bd3802d599ec272175fc96b3710c863a8ea64a379a18d5";
function toStaff(row: Row): Staff { return { id: Number(row.id), phone: String(row.phone), name: String(row.name), role: String(row.role) as Role }; }

export function session(token: string | undefined): Staff | null {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const now = Date.now();
  const row = db().prepare("SELECT u.id,u.phone,u.name,u.role,s.last_seen FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked=0 AND u.active=1").get(tokenHash(token));
  if (!row) return null;
  if (now - Number(row.last_seen) >= idleMs) {
    db().prepare("UPDATE staff_sessions SET revoked=1 WHERE token_hash=?").run(tokenHash(token));
    return null;
  }
  db().prepare("UPDATE staff_sessions SET last_seen=? WHERE token_hash=?").run(now, tokenHash(token));
  return toStaff(row);
}
export function logout(token: string | undefined, all: boolean) {
  const staff = session(token);
  if (!staff || !token) return;
  if (all) db().prepare("UPDATE staff_sessions SET revoked=1 WHERE user_id=?").run(staff.id);
  else db().prepare("UPDATE staff_sessions SET revoked=1 WHERE token_hash=?").run(tokenHash(token));
  audit(staff, all ? "Выход на всех устройствах" : "Выход");
}
export function listUsers() { return db().prepare("SELECT id,name,phone,role,active FROM staff_users WHERE active=1 ORDER BY id").all(); }
export function addUser(actor: Staff, name: string, phone: string, password: string, role: Role) {
  const result = db().prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,?)").run(name.trim(), normalizePhone(phone), hashPassword(password), role);
  audit(actor, "Создание сотрудника", `ID ${result.lastInsertRowid}; роль ${role}`);
}
export function changeRole(actor: Staff, id: number, role: Role) {
  if (id === actor.id) throw new Error("Нельзя менять собственную роль.");
  const previous = db().prepare("SELECT role FROM staff_users WHERE id=?").get(id);
  if (previous?.role === "owner" && role === "operator" && Number(db().prepare("SELECT COUNT(*) AS count FROM staff_users WHERE role='owner' AND active=1").get()?.count) <= 1) throw new Error("Нельзя удалить последнего Owner.");
  const result = db().prepare("UPDATE staff_users SET role=? WHERE id=?").run(role, id);
  if (!result.changes) throw new Error("Сотрудник не найден.");
  db().prepare("UPDATE staff_sessions SET revoked=1 WHERE user_id=?").run(id);
  audit(actor, "Смена роли", `ID ${id}; роль ${role}`);
}
export function removeUser(actor: Staff, id: number) {
  if (id === actor.id) throw new Error("Нельзя удалить свою учётную запись.");
  const user = db().prepare("SELECT role,name FROM staff_users WHERE id=? AND active=1").get(id);
  if (!user) throw new Error("Сотрудник не найден.");
  if (user.role === "owner" && Number(db().prepare("SELECT COUNT(*) AS count FROM staff_users WHERE role='owner' AND active=1").get()?.count) <= 1) throw new Error("Нельзя удалить последнего Owner.");
  db().prepare("UPDATE staff_users SET active=0 WHERE id=?").run(id);
  db().prepare("UPDATE staff_sessions SET revoked=1 WHERE user_id=?").run(id);
  audit(actor, "Удаление сотрудника", `ID ${id}; ${user.name}`);
}
export function listAudit() { return db().prepare("SELECT actor_name,action,details,at FROM staff_audit ORDER BY id DESC LIMIT 200").all(); }
export function listOrders() { return db().prepare("SELECT id,token,status,delivery_title,total_mdl,created_at,phone,name FROM orders ORDER BY id DESC LIMIT 200").all(); }
export function createInquiry(phone: string, part: string, vehicle: string, source: "expert" | "catalog") {
  const now = new Date().toISOString();
  const normalized = normalizePhone(phone);
  const recent = Number(db().prepare("SELECT COUNT(*) AS count FROM inquiries WHERE phone=? AND created_at>=?").get(normalized, new Date(Date.now() - 60_000).toISOString())?.count ?? 0);
  if (recent >= 5) throw new Error("Попробуйте отправить заявку позже.");
  const result = db().prepare("INSERT INTO inquiries(phone,part,vehicle,source,created_at) VALUES(?,?,?,?,?)").run(normalized, part.trim(), vehicle.trim(), source, now);
  return Number(result.lastInsertRowid);
}
export function listInquiries(source: "expert" | "catalog") { return db().prepare("SELECT id,phone,part,vehicle,status,created_at FROM inquiries WHERE source=? ORDER BY id DESC LIMIT 200").all(source); }
export function revealInquiryPhone(actor: Staff, id: number) {
  const row = db().prepare("SELECT phone FROM inquiries WHERE id=?").get(id);
  if (!row) return null;
  audit(actor, "Просмотр полного телефона клиента", `Заявка № ${id}`);
  return String(row.phone);
}
export function setInquiryStatus(actor: Staff, id: number, status: string) {
  if (!["new", "in_progress", "closed"].includes(status)) throw new Error("Неверный статус.");
  const result = db().prepare("UPDATE inquiries SET status=? WHERE id=?").run(status, id);
  if (!result.changes) throw new Error("Заявка не найдена.");
  audit(actor, "Смена статуса заявки", `Заявка № ${id}: ${status}`);
}
export function moneySummary() {
  const sales = db().prepare("SELECT COUNT(*) AS orders, COALESCE(SUM(total_mdl),0) AS total FROM orders").get();
  const costs = db().prepare("SELECT COALESCE(SUM(quantity*(unit_price_mdl-unit_cost_mdl)),0) AS gross, SUM(CASE WHEN unit_cost_mdl IS NULL THEN 1 ELSE 0 END) AS missing FROM order_items").get();
  return { orders: Number(sales?.orders ?? 0), total: Number(sales?.total ?? 0), gross: Number(costs?.gross ?? 0), missing: Number(costs?.missing ?? 0) };
}
export function exportOrders() { return db().prepare("SELECT id,status,delivery_title,total_mdl,created_at,phone,name FROM orders ORDER BY id DESC").all(); }
export function listInventory() { return db().prepare("SELECT id,name,price_mdl,stock,photos_json,category_id,part_type_id FROM catalog_products ORDER BY name LIMIT 300").all(); }
export function addStaffInquiry(actor: Staff, input: Record<string, unknown>) {
  const phone = typeof input.phone === "string" ? normalizePhone(input.phone) : "";
  const part = typeof input.part === "string" ? input.part.trim() : "";
  const vehicle = typeof input.vehicle === "string" ? input.vehicle.trim() : "";
  if (!/^\+\d{8,15}$/.test(phone) || part.length < 2 || part.length > 160 || vehicle.length > 160) throw new Error("Проверьте телефон и деталь.");
  const result = db().prepare("INSERT INTO inquiries(phone,part,vehicle,source,created_at) VALUES(?,?,?,?,?)").run(phone, part, vehicle, "expert", new Date().toISOString());
  audit(actor, "Новое обращение", `№ ${result.lastInsertRowid}`);
}
export function listCosts() { return db().prepare("SELECT id,name,price_mdl,cost_mdl FROM catalog_products ORDER BY name LIMIT 300").all(); }
export function setCost(actor: Staff, id: string, cost: number) {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Неверная себестоимость.");
  const result = db().prepare("UPDATE catalog_products SET cost_mdl=? WHERE id=?").run(cost, id);
  if (!result.changes) throw new Error("Товар не найден.");
  audit(actor, "Правка себестоимости", `${id}: ${cost} L.`);
}
export function updateSettings(actor: Staff, input: Record<string, unknown>) {
  const current = getSettings();
  const address = input.pickupAddress;
  const pickupHours = input.pickupHours;
  const operatorHours = input.operatorHours;
  const rate = input.rubPerMdl === "" ? null : Number(input.rubPerMdl);
  const phonePmr = input.phonePmr;
  const phoneMoldova = input.phoneMoldova;
  const viber = input.viberUrl;
  const telegram = input.telegramUrl;
  if (typeof address !== "string" || !address.trim() || address.length > 200 || typeof pickupHours !== "string" || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(pickupHours) || typeof operatorHours !== "string" || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(operatorHours) || (rate !== null && (!Number.isFinite(rate) || rate <= 0 || rate > 1000))) throw new Error("Проверьте настройки.");
  if (typeof phonePmr !== "string" || typeof phoneMoldova !== "string" || !/^\+\d{8,15}$/.test(normalizePhone(phonePmr)) || !/^\+\d{8,15}$/.test(normalizePhone(phoneMoldova))) throw new Error("Проверьте телефоны.");
  if (typeof viber !== "string" || typeof telegram !== "string" || viber.length > 300 || telegram.length > 300 || (viber && !/^(https:\/\/|viber:\/\/)/i.test(viber)) || (telegram && !/^https:\/\//i.test(telegram))) throw new Error("Проверьте ссылки Viber и Telegram.");
  const line = (value: unknown, fallback: string, limit: number) => (typeof value === "string" ? value.split("\r\n").join("\n").trim().slice(0, limit) : fallback);
  const receipt = {
    header: line(input.receiptHeader, current.receipt.header, 200),
    requisites: line(input.receiptRequisites, current.receipt.requisites, 1000),
    signature: line(input.receiptSignature, current.receipt.signature, 200),
    warranty: line(input.receiptWarranty, current.receipt.warranty, 1000),
    invoiceTitle: line(input.receiptInvoiceTitle, current.receipt.invoiceTitle, 200),
    fiscalNumber: line(input.receiptFiscalNumber, current.receipt.fiscalNumber, 60),
  };
  const next = { ...current, pickupAddress: address.trim(), pickupHours, operatorHours, operatorStartHour: Number(operatorHours.slice(0, 2)), operatorEndHour: Number(operatorHours.split("-")[1]?.slice(0, 2)), rubPerMdl: rate, phones: { pmr: normalizePhone(phonePmr), moldova: normalizePhone(phoneMoldova) }, messengers: { viber, telegram }, receipt };
  if (next.operatorStartHour >= next.operatorEndHour || next.operatorEndHour > 24) throw new Error("Проверьте часы оператора.");
  db().prepare("UPDATE settings SET value=? WHERE id=1").run(JSON.stringify(next));
  audit(actor, "Изменение настроек", "Адрес, часы или курс валют");
}
export function setInventory(actor: Staff, id: string, price: number, stock: number, categoryId?: string | null) {
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) throw new Error("Неверная цена или остаток.");
  const before = db().prepare("SELECT price_mdl,stock,category_id FROM catalog_products WHERE id=?").get(id);
  if (!before) throw new Error("Товар не найден.");
  db().prepare("UPDATE catalog_products SET price_mdl=?,stock=? WHERE id=?").run(price, stock, id);
  if (categoryId !== undefined && (before.category_id ?? null) !== categoryId) {
    db().prepare("UPDATE catalog_products SET category_id=? WHERE id=?").run(categoryId, id);
    audit(actor, "Смена категории детали", `${id}: ${before.category_id ?? "без категории"} → ${categoryId ?? "без категории"}`);
  }
  if (Number(before.price_mdl) !== price) audit(actor, "Правка цены", `${id}: ${before.price_mdl} → ${price} L.`);
  if (Number(before.stock) !== stock) audit(actor, "Правка остатка", `${id}: ${before.stock} → ${stock}`);
}
export function importInventory(actor: Staff, csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length || lines.length > 300) throw new Error("Импорт: от 1 до 300 строк.");
  const rows = lines[0].toLowerCase().replaceAll(" ", "") === "id,price,stock" ? lines.slice(1) : lines;
  if (!rows.length) throw new Error("Нет товаров для импорта.");
  const parsed = rows.map((line) => {
    const [id, priceText, stockText, extra] = line.split(",");
    const price = Number(priceText), stock = Number(stockText);
    if (!id || extra !== undefined || !/^\d+$/.test(priceText ?? "") || !/^\d+$/.test(stockText ?? "") || !Number.isSafeInteger(price) || !Number.isSafeInteger(stock)) throw new Error(`Неверная строка: ${line}`);
    return { id, price, stock };
  });
  if (new Set(parsed.map((row) => row.id)).size !== parsed.length) throw new Error("Повторяется ID товара.");
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const row of parsed) {
      const result = database.prepare("UPDATE catalog_products SET price_mdl=?,stock=? WHERE id=?").run(row.price, row.stock, row.id);
      if (!result.changes) throw new Error(`Не найден товар ${row.id}`);
    }
    audit(actor, "Импорт склада", `${parsed.length} товаров`);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
export function revealPhone(actor: Staff, orderId: number) {
  const row = db().prepare("SELECT phone FROM orders WHERE id=?").get(orderId);
  if (!row) return null;
  audit(actor, "Просмотр полного телефона клиента", `Заказ № ${orderId + 1000}`);
  return String(row.phone);
}
export function maskPhone(phone: string) {
  const match = /^(\+373)(\d{2})\d+(\d{2})$/.exec(phone);
  return match ? `${match[1]} ${match[2]} ***${match[3]}` : phone.length > 5 ? `${phone.slice(0, 4)} ***${phone.slice(-2)}` : "***";
}

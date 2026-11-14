import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getSettings } from "@/lib/checkout-db";

type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number; lastInsertRowid: number | bigint } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };

const require = createRequire(import.meta.url);
let connection: Database | undefined;
// Покупатель заходит редко, поэтому сессия живёт дольше сотрудничьей: 60 дней без захода.
const idleMs = 60 * 24 * 60 * 60 * 1000;

function db(): Database {
  if (connection) return connection;
  getSettings();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const database = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, surname TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS customer_sessions (token_hash TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      last_seen INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS customer_addresses (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
      title TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', street TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS customer_addresses_owner ON customer_addresses(customer_id);
    CREATE TABLE IF NOT EXISTS customer_attempts (id INTEGER PRIMARY KEY, login TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS customer_attempts_at ON customer_attempts(at);`);
  if (!database.prepare("PRAGMA table_info(orders)").all().some((column) => column.name === "customer_id")) database.exec("ALTER TABLE orders ADD COLUMN customer_id INTEGER");
  connection = database;
  return database;
}

export type Customer = { id: number; name: string; surname: string; email: string; phone: string; createdAt: string };

function toCustomer(row: Row): Customer {
  return { id: Number(row.id), name: String(row.name), surname: String(row.surname), email: String(row.email), phone: String(row.phone), createdAt: String(row.created_at) };
}

/** Номер можно вводить привычно: 77745636, 077745636 или +373 777 45 636 — это один и тот же человек. */
export function toInternational(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("373")) return `+${digits}`;
  return `+373${digits.replace(/^0+/, "")}`;
}

const emailShape = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 64), Buffer.from(hash, "hex"));
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
// Одна и та же дорогая проверка выполняется и для несуществующего адреса, чтобы ответ не выдавал, кто у нас зарегистрирован.
const dummyHash = "00000000000000000000000000000000:5b82ab929e21a911f34a948acc6a287ce3bb61734d92b0699fd4c4a2bba57371b91c6a4c192427b0bd3802d599ec272175fc96b3710c863a8ea64a379a18d5";

export class AccountError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

function startSession(customerId: number) {
  const token = randomBytes(32).toString("hex");
  db().prepare("INSERT INTO customer_sessions(token_hash,customer_id,last_seen) VALUES(?,?,?)").run(tokenHash(token), customerId, Date.now());
  return token;
}

export function registerCustomer(input: Record<string, unknown>): { customer: Customer; token: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const surname = typeof input.surname === "string" ? input.surname.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = toInternational(typeof input.phone === "string" ? input.phone : "");
  const password = typeof input.password === "string" ? input.password : "";
  if (name.length < 2 || name.length > 60) throw new AccountError("name", "Напишите имя.");
  if (surname.length > 60) throw new AccountError("surname", "Фамилия слишком длинная.");
  if (!emailShape.test(email) || email.length > 120) throw new AccountError("email", "Проверьте адрес электронной почты.");
  if (!/^\+\d{8,15}$/.test(phone)) throw new AccountError("phone", "Проверьте номер телефона.");
  if (password.length < 8) throw new AccountError("password", "Пароль должен быть не короче 8 символов.");
  if (password.length > 200) throw new AccountError("password", "Пароль слишком длинный.");
  if (input.agreed !== true) throw new AccountError("agreed", "Подтвердите согласие на обработку данных.");
  if (db().prepare("SELECT id FROM customers WHERE email=?").get(email)) throw new AccountError("email", "На эту почту уже есть кабинет. Войдите или восстановите пароль у оператора.");
  if (db().prepare("SELECT id FROM customers WHERE phone=?").get(phone)) throw new AccountError("phone", "На этот телефон уже есть кабинет. Войдите по нему.");
  const result = db().prepare("INSERT INTO customers(name,surname,email,phone,password_hash,created_at) VALUES(?,?,?,?,?,?)")
    .run(name, surname, email, phone, hashPassword(password), new Date().toISOString());
  const customer = customerById(Number(result.lastInsertRowid))!;
  return { customer, token: startSession(customer.id) };
}

/** Вход по почте или по телефону — покупатель помнит что-то одно. */
export function loginCustomer(loginInput: string, password: string): { customer: Customer; token: string } | null {
  const login = typeof loginInput === "string" ? loginInput.trim().toLowerCase() : "";
  if (!login || typeof password !== "string") return null;
  const database = db();
  const now = Date.now();
  database.prepare("DELETE FROM customer_attempts WHERE at<?").run(now - 60_000);
  const attempts = Number(database.prepare("SELECT COUNT(*) AS count FROM customer_attempts WHERE login=?").get(login)?.count ?? 0);
  if (attempts >= 10) return null;
  database.prepare("INSERT INTO customer_attempts(login,at) VALUES(?,?)").run(login, now);
  const phone = toInternational(login);
  const row = database.prepare("SELECT * FROM customers WHERE (email=? OR phone=?) AND active=1").get(login, phone || "-");
  if (!verifyPassword(password, String(row?.password_hash ?? dummyHash))) return null;
  if (!row) return null;
  const customer = toCustomer(row);
  return { customer, token: startSession(customer.id) };
}

export function customerById(id: number): Customer | null {
  const row = db().prepare("SELECT * FROM customers WHERE id=? AND active=1").get(id);
  return row ? toCustomer(row) : null;
}

export function customerBySession(token: string | undefined): Customer | null {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const hash = tokenHash(token);
  const row = db().prepare("SELECT c.* , s.last_seen FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.revoked=0 AND c.active=1").get(hash);
  if (!row) return null;
  if (Date.now() - Number(row.last_seen) >= idleMs) {
    db().prepare("UPDATE customer_sessions SET revoked=1 WHERE token_hash=?").run(hash);
    return null;
  }
  db().prepare("UPDATE customer_sessions SET last_seen=? WHERE token_hash=?").run(Date.now(), hash);
  return toCustomer(row);
}

export function logoutCustomer(token: string | undefined, everywhere = false) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return;
  const customer = customerBySession(token);
  if (everywhere && customer) db().prepare("UPDATE customer_sessions SET revoked=1 WHERE customer_id=?").run(customer.id);
  else db().prepare("UPDATE customer_sessions SET revoked=1 WHERE token_hash=?").run(tokenHash(token));
}

export function updateProfile(customer: Customer, input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const surname = typeof input.surname === "string" ? input.surname.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = toInternational(typeof input.phone === "string" ? input.phone : "");
  if (name.length < 2 || name.length > 60) throw new AccountError("name", "Напишите имя.");
  if (surname.length > 60) throw new AccountError("surname", "Фамилия слишком длинная.");
  if (!emailShape.test(email)) throw new AccountError("email", "Проверьте адрес электронной почты.");
  if (!/^\+\d{8,15}$/.test(phone)) throw new AccountError("phone", "Проверьте номер телефона.");
  const takenEmail = db().prepare("SELECT id FROM customers WHERE email=? AND id<>?").get(email, customer.id);
  if (takenEmail) throw new AccountError("email", "Эта почта занята другим кабинетом.");
  const takenPhone = db().prepare("SELECT id FROM customers WHERE phone=? AND id<>?").get(phone, customer.id);
  if (takenPhone) throw new AccountError("phone", "Этот телефон занят другим кабинетом.");
  db().prepare("UPDATE customers SET name=?,surname=?,email=?,phone=? WHERE id=?").run(name, surname, email, phone, customer.id);
}

export function changePassword(customer: Customer, current: unknown, next: unknown) {
  const row = db().prepare("SELECT password_hash FROM customers WHERE id=?").get(customer.id);
  if (!row || !verifyPassword(typeof current === "string" ? current : "", String(row.password_hash))) throw new AccountError("current", "Текущий пароль не подходит.");
  const value = typeof next === "string" ? next : "";
  if (value.length < 8) throw new AccountError("password", "Новый пароль должен быть не короче 8 символов.");
  db().prepare("UPDATE customers SET password_hash=? WHERE id=?").run(hashPassword(value), customer.id);
  // Пароль сменили — остальные устройства разлогиниваются.
  db().prepare("UPDATE customer_sessions SET revoked=1 WHERE customer_id=?").run(customer.id);
}

export type Address = { id: number; title: string; city: string; street: string; note: string; isDefault: boolean };

export function listAddresses(customerId: number): Address[] {
  return db().prepare("SELECT * FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC, id").all(customerId).map((row) => ({
    id: Number(row.id), title: String(row.title), city: String(row.city), street: String(row.street),
    note: String(row.note), isDefault: Number(row.is_default) === 1,
  }));
}

export function saveAddress(customer: Customer, input: Record<string, unknown>) {
  const city = typeof input.city === "string" ? input.city.trim().slice(0, 80) : "";
  const street = typeof input.street === "string" ? input.street.trim().slice(0, 160) : "";
  if (city.length < 2) throw new AccountError("city", "Укажите населённый пункт.");
  if (street.length < 2) throw new AccountError("street", "Укажите улицу и дом.");
  const title = (typeof input.title === "string" ? input.title.trim() : "").slice(0, 60) || city;
  const note = (typeof input.note === "string" ? input.note.trim() : "").slice(0, 200);
  const makeDefault = input.isDefault === true;
  const id = Number(input.id);
  if (Number.isSafeInteger(id) && id > 0) {
    const result = db().prepare("UPDATE customer_addresses SET title=?,city=?,street=?,note=? WHERE id=? AND customer_id=?").run(title, city, street, note, id, customer.id);
    if (!result.changes) throw new AccountError("id", "Адрес не найден.");
    if (makeDefault) setDefaultAddress(customer, id);
    return id;
  }
  if (listAddresses(customer.id).length >= 10) throw new AccountError("city", "Больше десяти адресов не храним — удалите лишний.");
  const created = db().prepare("INSERT INTO customer_addresses(customer_id,title,city,street,note,is_default,created_at) VALUES(?,?,?,?,?,?,?)")
    .run(customer.id, title, city, street, note, 0, new Date().toISOString());
  const newId = Number(created.lastInsertRowid);
  if (makeDefault || listAddresses(customer.id).length === 1) setDefaultAddress(customer, newId);
  return newId;
}

export function setDefaultAddress(customer: Customer, id: number) {
  const database = db();
  database.prepare("UPDATE customer_addresses SET is_default=0 WHERE customer_id=?").run(customer.id);
  const result = database.prepare("UPDATE customer_addresses SET is_default=1 WHERE id=? AND customer_id=?").run(id, customer.id);
  if (!result.changes) throw new AccountError("id", "Адрес не найден.");
}

export function deleteAddress(customer: Customer, id: number) {
  const result = db().prepare("DELETE FROM customer_addresses WHERE id=? AND customer_id=?").run(id, customer.id);
  if (!result.changes) throw new AccountError("id", "Адрес не найден.");
}

export type CustomerOrder = {
  number: number; token: string; status: string; createdAt: string; totalMdl: number; deliveryCostMdl: number;
  deliveryTitle: string; paymentTitle: string; receiptToken: string | null;
  items: { name: string; quantity: number; unitPriceMdl: number }[];
};

/** В историю попадают и заказы, сделанные до регистрации: их узнаём по тому же телефону. */
export function customerOrders(customer: Customer): CustomerOrder[] {
  const rows = db().prepare("SELECT * FROM orders WHERE customer_id=? OR phone=? ORDER BY id DESC LIMIT 100").all(customer.id, customer.phone);
  const items = db().prepare("SELECT order_id, name, quantity, unit_price_mdl FROM order_items WHERE order_id=?");
  return rows.map((row) => ({
    number: Number(row.id) + 1000,
    token: String(row.token),
    status: String(row.status),
    createdAt: String(row.created_at),
    totalMdl: Number(row.total_mdl),
    deliveryCostMdl: Number(row.delivery_cost_mdl ?? 0),
    deliveryTitle: String(row.delivery_title),
    paymentTitle: String(row.payment_title),
    receiptToken: (row.receipt_token as string | null) ?? null,
    items: items.all(Number(row.id)).map((item) => ({ name: String(item.name), quantity: Number(item.quantity), unitPriceMdl: Number(item.unit_price_mdl) })),
  }));
}

/** Заказ, оформленный вошедшим покупателем, сразу привязывается к его кабинету. */
export function attachOrderToCustomer(orderId: number, customerId: number) {
  db().prepare("UPDATE orders SET customer_id=? WHERE id=? AND customer_id IS NULL").run(customerId, orderId);
}

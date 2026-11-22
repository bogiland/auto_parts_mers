import { legacyQuery, transaction } from "@/lib/db";
import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { toInternational as normalizeToInternational } from "@/lib/staff-db";

type Row = Record<string, string | number | null>;
// Покупатель заходит редко, поэтому сессия живёт дольше сотрудничьей: 60 дней без захода.
const idleMs = 60 * 24 * 60 * 60 * 1000;

export type Customer = { id: number; name: string; surname: string; email: string; phone: string; createdAt: string };

function toCustomer(row: Row): Customer {
  return { id: Number(row.id), name: String(row.name), surname: String(row.surname), email: String(row.email), phone: String(row.phone), createdAt: String(row.created_at) };
}

/** Номер можно вводить привычно: 77745636, 077745636 или +373 777 45 636 — это один и тот же человек. */
export const toInternational = normalizeToInternational;

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

async function startSession(customerId: number) {
return (await transaction(async () => {
  const token = randomBytes(32).toString("hex");
  (await legacyQuery.run<Row>("INSERT INTO customer_sessions(token_hash,customer_id,last_seen) VALUES(?,?,?)", [tokenHash(token), customerId, Date.now()]));
  return token;

}));
}

export async function registerCustomer(input: Record<string, unknown>): Promise<{ customer: Customer; token: string }> {
return (await transaction(async () => {
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
  if ((await legacyQuery.get<Row>("SELECT id FROM customers WHERE email=?", [email]))) throw new AccountError("email", "На эту почту уже есть кабинет. Войдите или восстановите пароль у оператора.");
  if ((await legacyQuery.get<Row>("SELECT id FROM customers WHERE phone=?", [phone]))) throw new AccountError("phone", "На этот телефон уже есть кабинет. Войдите по нему.");
  const result = (await legacyQuery.run<Row>("INSERT INTO customers(name,surname,email,phone,password_hash,created_at) VALUES(?,?,?,?,?,?)", [name, surname, email, phone, hashPassword(password), new Date().toISOString()]));
  const customer = (await customerById(Number(result.lastInsertRowid)))!;
  return { customer, token: (await startSession(customer.id)) };

}));
}

/** Вход по почте или по телефону — покупатель помнит что-то одно. */
export async function loginCustomer(loginInput: string, password: string): Promise<{ customer: Customer; token: string } | null> {
return (await transaction(async () => {
  const login = typeof loginInput === "string" ? loginInput.trim().toLowerCase() : "";
  if (!login || typeof password !== "string") return null;
  
  const now = Date.now();
  (await legacyQuery.run<Row>("DELETE FROM customer_attempts WHERE at<?", [now - 60_000]));
  const attempts = Number((await legacyQuery.get<Row>("SELECT COUNT(*) AS count FROM customer_attempts WHERE login=?", [login]))?.count ?? 0);
  if (attempts >= 10) return null;
  (await legacyQuery.run<Row>("INSERT INTO customer_attempts(login,at) VALUES(?,?)", [login, now]));
  const phone = toInternational(login);
  const row = (await legacyQuery.get<Row>("SELECT * FROM customers WHERE (email=? OR phone=?) AND active=1", [login, phone || "-"]));
  if (!verifyPassword(password, String(row?.password_hash ?? dummyHash))) return null;
  if (!row) return null;
  const customer = toCustomer(row);
  return { customer, token: (await startSession(customer.id)) };

}));
}

export async function customerById(id: number): Promise<Customer | null> {
  const row = (await legacyQuery.get<Row>("SELECT * FROM customers WHERE id=? AND active=1", [id]));
  return row ? toCustomer(row) : null;
}

export async function customerBySession(token: string | undefined): Promise<Customer | null> {
return (await transaction(async () => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const hash = tokenHash(token);
  const row = (await legacyQuery.get<Row>("SELECT c.* , s.last_seen FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.revoked=0 AND c.active=1", [hash]));
  if (!row) return null;
  if (Date.now() - Number(row.last_seen) >= idleMs) {
    (await legacyQuery.run<Row>("UPDATE customer_sessions SET revoked=1 WHERE token_hash=?", [hash]));
    return null;
  }
  (await legacyQuery.run<Row>("UPDATE customer_sessions SET last_seen=? WHERE token_hash=?", [Date.now(), hash]));
  return toCustomer(row);

}));
}

export async function logoutCustomer(token: string | undefined, everywhere = false) {
return (await transaction(async () => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return;
  const customer = (await customerBySession(token));
  if (everywhere && customer) (await legacyQuery.run<Row>("UPDATE customer_sessions SET revoked=1 WHERE customer_id=?", [customer.id]));
  else (await legacyQuery.run<Row>("UPDATE customer_sessions SET revoked=1 WHERE token_hash=?", [tokenHash(token)]));

}));
}

export async function updateProfile(customer: Customer, input: Record<string, unknown>) {
return (await transaction(async () => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const surname = typeof input.surname === "string" ? input.surname.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = toInternational(typeof input.phone === "string" ? input.phone : "");
  if (name.length < 2 || name.length > 60) throw new AccountError("name", "Напишите имя.");
  if (surname.length > 60) throw new AccountError("surname", "Фамилия слишком длинная.");
  if (!emailShape.test(email)) throw new AccountError("email", "Проверьте адрес электронной почты.");
  if (!/^\+\d{8,15}$/.test(phone)) throw new AccountError("phone", "Проверьте номер телефона.");
  const takenEmail = (await legacyQuery.get<Row>("SELECT id FROM customers WHERE email=? AND id<>?", [email, customer.id]));
  if (takenEmail) throw new AccountError("email", "Эта почта занята другим кабинетом.");
  const takenPhone = (await legacyQuery.get<Row>("SELECT id FROM customers WHERE phone=? AND id<>?", [phone, customer.id]));
  if (takenPhone) throw new AccountError("phone", "Этот телефон занят другим кабинетом.");
  (await legacyQuery.run<Row>("UPDATE customers SET name=?,surname=?,email=?,phone=? WHERE id=?", [name, surname, email, phone, customer.id]));

}));
}

export async function changePassword(customer: Customer, current: unknown, next: unknown) {
return (await transaction(async () => {
  const row = (await legacyQuery.get<Row>("SELECT password_hash FROM customers WHERE id=?", [customer.id]));
  if (!row || !verifyPassword(typeof current === "string" ? current : "", String(row.password_hash))) throw new AccountError("current", "Текущий пароль не подходит.");
  const value = typeof next === "string" ? next : "";
  if (value.length < 8) throw new AccountError("password", "Новый пароль должен быть не короче 8 символов.");
  (await legacyQuery.run<Row>("UPDATE customers SET password_hash=? WHERE id=?", [hashPassword(value), customer.id]));
  // Пароль сменили — остальные устройства разлогиниваются.
  (await legacyQuery.run<Row>("UPDATE customer_sessions SET revoked=1 WHERE customer_id=?", [customer.id]));

}));
}

export type Address = { id: number; title: string; city: string; street: string; note: string; isDefault: boolean };

export async function listAddresses(customerId: number): Promise<Address[]> {
  return (await legacyQuery.all<Row>("SELECT * FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC, id", [customerId])).map((row) => ({
    id: Number(row.id), title: String(row.title), city: String(row.city), street: String(row.street),
    note: String(row.note), isDefault: Number(row.is_default) === 1,
  }));
}

export async function saveAddress(customer: Customer, input: Record<string, unknown>) {
return (await transaction(async () => {
  const city = typeof input.city === "string" ? input.city.trim().slice(0, 80) : "";
  const street = typeof input.street === "string" ? input.street.trim().slice(0, 160) : "";
  if (city.length < 2) throw new AccountError("city", "Укажите населённый пункт.");
  if (street.length < 2) throw new AccountError("street", "Укажите улицу и дом.");
  const title = (typeof input.title === "string" ? input.title.trim() : "").slice(0, 60) || city;
  const note = (typeof input.note === "string" ? input.note.trim() : "").slice(0, 200);
  const makeDefault = input.isDefault === true;
  const id = Number(input.id);
  if (Number.isSafeInteger(id) && id > 0) {
    const result = (await legacyQuery.run<Row>("UPDATE customer_addresses SET title=?,city=?,street=?,note=? WHERE id=? AND customer_id=?", [title, city, street, note, id, customer.id]));
    if (!result.changes) throw new AccountError("id", "Адрес не найден.");
    if (makeDefault) (await setDefaultAddress(customer, id));
    return id;
  }
  if ((await listAddresses(customer.id)).length >= 10) throw new AccountError("city", "Больше десяти адресов не храним — удалите лишний.");
  const created = (await legacyQuery.run<Row>("INSERT INTO customer_addresses(customer_id,title,city,street,note,is_default,created_at) VALUES(?,?,?,?,?,?,?)", [customer.id, title, city, street, note, 0, new Date().toISOString()]));
  const newId = Number(created.lastInsertRowid);
  if (makeDefault || (await listAddresses(customer.id)).length === 1) (await setDefaultAddress(customer, newId));
  return newId;

}));
}

export async function setDefaultAddress(customer: Customer, id: number) {
return (await transaction(async () => {
  
  (await legacyQuery.run<Row>("UPDATE customer_addresses SET is_default=0 WHERE customer_id=?", [customer.id]));
  const result = (await legacyQuery.run<Row>("UPDATE customer_addresses SET is_default=1 WHERE id=? AND customer_id=?", [id, customer.id]));
  if (!result.changes) throw new AccountError("id", "Адрес не найден.");

}));
}

export async function deleteAddress(customer: Customer, id: number) {
return (await transaction(async () => {
  const result = (await legacyQuery.run<Row>("DELETE FROM customer_addresses WHERE id=? AND customer_id=?", [id, customer.id]));
  if (!result.changes) throw new AccountError("id", "Адрес не найден.");

}));
}

export type CustomerOrder = {
  number: number; token: string; status: string; createdAt: string; totalMdl: number; deliveryCostMdl: number;
  deliveryTitle: string; paymentTitle: string; receiptToken: string | null;
  items: { name: string; quantity: number; unitPriceMdl: number }[];
};

/** В историю попадают и заказы, сделанные до регистрации: их узнаём по тому же телефону. */
export async function customerOrders(customer: Customer): Promise<CustomerOrder[]> {
  const rows = (await legacyQuery.all<Row>("SELECT * FROM orders WHERE customer_id=? OR phone=? ORDER BY id DESC LIMIT 100", [customer.id, customer.phone]));
  return Promise.all(rows.map(async (row) => ({
    number: Number(row.id) + 1000,
    token: String(row.token),
    status: String(row.status),
    createdAt: String(row.created_at),
    totalMdl: Number(row.total_mdl),
    deliveryCostMdl: Number(row.delivery_cost_mdl ?? 0),
    deliveryTitle: String(row.delivery_title),
    paymentTitle: String(row.payment_title),
    receiptToken: (row.receipt_token as string | null) ?? null,
    items: (await legacyQuery.all<Row>("SELECT order_id, name, quantity, unit_price_mdl FROM order_items WHERE order_id=?", [Number(row.id)])).map((item) => ({ name: String(item.name), quantity: Number(item.quantity), unitPriceMdl: Number(item.unit_price_mdl) })),
  })));
}

/** Заказ, оформленный вошедшим покупателем, сразу привязывается к его кабинету. */
export async function attachOrderToCustomer(orderId: number, customerId: number) {
return (await transaction(async () => {
  (await legacyQuery.run<Row>("UPDATE orders SET customer_id=? WHERE id=? AND customer_id IS NULL", [customerId, orderId]));

}));
}

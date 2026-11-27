import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ensureSeeded, getSettings } from "@/lib/checkout-db";
import { inTx, many, one, run, tx } from "@/lib/db";
import { allow, windows } from "@/lib/rate-limit";

export type Role = "owner" | "operator";
export type Staff = { id: number; phone: string; role: Role; name: string };
type Row = Record<string, unknown>;

const idleMs = 2 * 60 * 60 * 1000;
/** Бездействие владельца обрывает сессию быстрее: его доступом меняют права и выгружают заказы. */
const ownerIdleMs = 30 * 60 * 1000;

export function normalizePhone(value: string) { return value.replace(/[\s()\-]/g, ""); }

/**
 * Приводит номер к международному виду. Понимает и местный набор, и полный:
 * 77745636, 077745636, +373 060 666 853 — всё это один и тот же +37360666853.
 * Номер другой страны, записанный с «+», остаётся как есть: у покупателей бывают
 * румынские и украинские номера, и подставлять им код Молдовы нельзя.
 */
export function toInternational(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(raw);
    if (parsed?.isValid()) return parsed.number;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // После кода страны местные набирают ещё и ноль — он к номеру не относится.
  const national = (digits.startsWith("373") ? digits.slice(3) : digits).replace(/^0+/, "");
  if (!national) return "";
  const local = parsePhoneNumberFromString(national, "MD");
  return local?.isValid() ? local.number : `+373${national}`;
}

/** Сотрудник набирает номер как привык: 77745636, 077745636 или +373 777 45 636 — это один и тот же человек. */
export function phoneVariants(value: string): string[] {
  const digits = value.replace(/\D/g, "");
  const found = new Set<string>();
  const plain = normalizePhone(value);
  if (plain) found.add(plain);
  if (digits) {
    found.add(`+${digits}`);
    if (!digits.startsWith("373")) found.add(`+373${digits.replace(/^0+/, "")}`);
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
const dummyHash = "00000000000000000000000000000000:5b82ab929e21a911f34a948acc6a287ce3bb61734d92b0699fd4c4a2bba57371b91c6a4c192427b0bd3802d599ec272175fc96b3710c863a8ea64a379a18d5";
function toStaff(row: Row): Staff { return { id: Number(row.id), phone: String(row.phone), name: String(row.name), role: String(row.role) as Role }; }

export async function audit(actor: Staff | null, action: string, details = "") {
  await run("INSERT INTO staff_audit (actor_id, actor_name, action, details, at) VALUES ($1,$2,$3,$4,$5)",
    [actor?.id ?? null, actor?.name ?? "Система", action, details, new Date().toISOString()]);
}

/**
 * Вход сотрудника.
 *
 * Пределы раздельные: по номеру и по адресу обращения. Прежний общий предел
 * «30 попыток в минуту на всех» означал, что один бот, перебирающий пароли,
 * выбирал его целиком — и операторы переставали входить до конца минуты.
 * Теперь перебор упирается в свой адрес и в свой номер, а чужой вход не трогает.
 */
export async function login(phoneInput: string, password: string, ip = "local"): Promise<{ staff: Staff; token: string } | null> {
  await ensureSeeded();
  const candidates = phoneVariants(phoneInput);
  const phone = candidates[0] ?? "";
  const now = Date.now();

  if (!(await allow("staff-login:ip", ip, windows.staffLoginIp, now))) return null;
  if (!(await allow("staff-login:phone", phone, windows.staffLoginPhone, now))) return null;

  // У доступа, выданного покупателю, своего пароля нет: сверяем с паролем его кабинета,
  // чтобы человеку не приходилось помнить два разных.
  const row = await one(
    `SELECT u.*, c.password_hash AS customer_hash FROM staff_users u
     LEFT JOIN customers c ON c.id = u.customer_id AND c.active = 1
     WHERE u.phone = ANY($1) AND u.active = 1`,
    [candidates],
  );
  const stored = row?.customer_id ? row.customer_hash : row?.password_hash;
  // Та же дорогая проверка выполняется и для неизвестного номера, чтобы ответ не выдавал, кто у нас заведён.
  if (!verifyPassword(password, String(stored ?? dummyHash))) return null;
  if (!row) return null;

  const staff = toStaff(row);
  const token = randomBytes(32).toString("hex");
  await run("INSERT INTO staff_sessions (token_hash, user_id, last_seen) VALUES ($1,$2,$3)", [tokenHash(token), staff.id, now]);
  await audit(staff, "Вход");
  return { staff, token };
}

export async function session(token: string | undefined): Promise<Staff | null> {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const now = Date.now();
  const hash = tokenHash(token);
  const row = await one(
    `SELECT u.id, u.phone, u.name, u.role, s.last_seen FROM staff_sessions s
     JOIN staff_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked = 0 AND u.active = 1`,
    [hash],
  );
  if (!row) return null;
  // Привилегированная сессия обрывается быстрее: доступом владельца меняют права и выгружают данные.
  const limit = String(row.role) === "owner" ? ownerIdleMs : idleMs;
  if (now - Number(row.last_seen) >= limit) {
    await run("UPDATE staff_sessions SET revoked = 1 WHERE token_hash = $1", [hash]);
    return null;
  }
  await run("UPDATE staff_sessions SET last_seen = $1 WHERE token_hash = $2", [now, hash]);
  return toStaff(row);
}

export async function logout(token: string | undefined, all: boolean) {
  const staff = await session(token);
  if (!staff || !token) return;
  if (all) await run("UPDATE staff_sessions SET revoked = 1 WHERE user_id = $1", [staff.id]);
  else await run("UPDATE staff_sessions SET revoked = 1 WHERE token_hash = $1", [tokenHash(token)]);
  await audit(staff, all ? "Выход на всех устройствах" : "Выход");
}

export async function listUsers() {
  return (await many(
    `SELECT u.id, u.name, u.phone, u.role, u.active, u.customer_id, COALESCE(c.email, '') AS email
     FROM staff_users u LEFT JOIN customers c ON c.id = u.customer_id
     WHERE u.active = 1 ORDER BY u.id`,
  ));
}

export type StaffCandidate = { id: number; name: string; email: string; phone: string; role: Role | null };

/**
 * Поиск по посетителям сайта для выдачи доступа: по номеру клиента, имени, фамилии, почте или телефону.
 * Рядом сразу видно, есть ли у человека доступ и какой.
 */
export async function findPeople(query: string): Promise<StaffCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const text = `%${trimmed.toLowerCase()}%`;
  const byId = Number(trimmed);
  const rows = await many(
    `SELECT c.id, c.name, c.surname, c.email, c.phone,
       (SELECT u.role FROM staff_users u WHERE u.customer_id = c.id AND u.active = 1) AS role
     FROM customers c
     WHERE c.active = 1 AND (
       c.id = $1 OR lower(c.name) LIKE $2 OR lower(c.surname) LIKE $2
       OR lower(c.email) LIKE $2 OR replace(c.phone, '+', '') LIKE $3)
     ORDER BY c.id LIMIT 25`,
    [Number.isSafeInteger(byId) ? byId : -1, text, text.replace("+", "")],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: [String(row.name), String(row.surname)].filter(Boolean).join(" "),
    email: String(row.email),
    phone: String(row.phone),
    role: (row.role as Role | null) ?? null,
  }));
}

/** Выдать посетителю сайта доступ в админку. Пароль остаётся тот же, что и в его кабинете. */
export async function grantStaffAccess(actor: Staff, customerId: number, role: Role) {
  const person = await one("SELECT id, name, surname, phone FROM customers WHERE id = $1 AND active = 1", [customerId]);
  if (!person) throw new Error("Человек не найден. Найдите его поиском по кабинетам.");
  const name = [String(person.name), String(person.surname)].filter(Boolean).join(" ").trim() || `Клиент № ${customerId}`;
  const phone = String(person.phone);
  const existing = await one("SELECT id, customer_id FROM staff_users WHERE customer_id = $1 OR phone = $2", [customerId, phone]);
  if (existing) {
    if (!existing.customer_id) throw new Error("На этот телефон уже заведён отдельный сотрудник. Меняйте ему роль в списке ниже.");
    await run("UPDATE staff_users SET role = $1, active = 1, name = $2 WHERE id = $3", [role, name, existing.id]);
    await run("UPDATE staff_sessions SET revoked = 1 WHERE user_id = $1", [existing.id]);
    await audit(actor, "Доступ сотрудника обновлён", `клиент № ${customerId}; ${name}; роль ${role}`);
    return Number(existing.id);
  }
  // Пароля у строки доступа нет: вход сверяется с паролем кабинета.
  const created = await one<{ id: number }>(
    "INSERT INTO staff_users (name, phone, password_hash, role, customer_id) VALUES ($1,$2,'',$3,$4) RETURNING id",
    [name, phone, role, customerId],
  );
  await audit(actor, "Выдан доступ сотрудника", `клиент № ${customerId}; ${name}; роль ${role}`);
  return Number(created?.id);
}

export async function addUser(actor: Staff, name: string, phone: string, password: string, role: Role) {
  const created = await one<{ id: number }>(
    "INSERT INTO staff_users (name, phone, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id",
    [name.trim(), toInternational(phone), hashPassword(password), role],
  );
  await audit(actor, "Создание сотрудника", `ID ${created?.id}; роль ${role}`);
}

async function ownersLeft() {
  const row = await one<{ count: string }>("SELECT COUNT(*) AS count FROM staff_users WHERE role = 'owner' AND active = 1");
  return Number(row?.count ?? 0);
}

export async function changeRole(actor: Staff, id: number, role: Role) {
  if (id === actor.id) throw new Error("Нельзя менять собственную роль.");
  const previous = await one("SELECT role FROM staff_users WHERE id = $1", [id]);
  if (previous?.role === "owner" && role === "operator" && (await ownersLeft()) <= 1) throw new Error("Нельзя удалить последнего Owner.");
  if (!(await run("UPDATE staff_users SET role = $1 WHERE id = $2", [role, id]))) throw new Error("Сотрудник не найден.");
  await run("UPDATE staff_sessions SET revoked = 1 WHERE user_id = $1", [id]);
  await audit(actor, "Смена роли", `ID ${id}; роль ${role}`);
}

export async function removeUser(actor: Staff, id: number) {
  if (id === actor.id) throw new Error("Нельзя удалить свою учётную запись.");
  const user = await one("SELECT role, name FROM staff_users WHERE id = $1 AND active = 1", [id]);
  if (!user) throw new Error("Сотрудник не найден.");
  if (user.role === "owner" && (await ownersLeft()) <= 1) throw new Error("Нельзя удалить последнего Owner.");
  await run("UPDATE staff_users SET active = 0 WHERE id = $1", [id]);
  await run("UPDATE staff_sessions SET revoked = 1 WHERE user_id = $1", [id]);
  await audit(actor, "Удаление сотрудника", `ID ${id}; ${user.name}`);
}

export async function listAudit() {
  return (await many("SELECT actor_name, action, details, at FROM staff_audit ORDER BY id DESC LIMIT 200"));
}

export async function listOrders() {
  return (await many("SELECT id, token, status, delivery_title, total_mdl, created_at, phone, name FROM orders ORDER BY id DESC LIMIT 200"));
}

export type InquiryDetails = { productId?: string | null; oem?: string; donor?: string; query?: string };

export async function createInquiry(phone: string, part: string, vehicle: string, source: "expert" | "catalog", details: InquiryDetails = {}) {
  await ensureSeeded();
  const now = new Date().toISOString();
  // Номер хранится в одном виде, как его набрал бы оператор: +373…, без пробелов.
  const normalized = toInternational(phone) || normalizePhone(phone);
  const recent = await one<{ count: string }>(
    "SELECT COUNT(*) AS count FROM inquiries WHERE phone = $1 AND created_at >= $2",
    [normalized, new Date(Date.now() - 60_000).toISOString()],
  );
  if (Number(recent?.count ?? 0) >= 5) throw new Error("Попробуйте отправить заявку позже.");
  const created = await one<{ id: number }>(
    "INSERT INTO inquiries (phone, part, vehicle, source, created_at, product_id, oem, donor, search_query) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    [normalized, part.trim(), vehicle.trim(), source, now, details.productId ?? null, (details.oem ?? "").trim(), (details.donor ?? "").trim(), (details.query ?? "").trim()],
  );
  return Number(created?.id);
}

export async function listInquiries(source: "expert" | "catalog") {
  return (await many("SELECT id, phone, part, vehicle, status, created_at, product_id, oem, donor, search_query FROM inquiries WHERE source = $1 ORDER BY id DESC LIMIT 200", [source]));
}

export async function revealInquiryPhone(actor: Staff, id: number) {
  const row = await one("SELECT phone FROM inquiries WHERE id = $1", [id]);
  if (!row) return null;
  await audit(actor, "Просмотр полного телефона клиента", `Заявка № ${id}`);
  return String(row.phone);
}

export async function setInquiryStatus(actor: Staff, id: number, status: string) {
  if (!["new", "in_progress", "closed"].includes(status)) throw new Error("Неверный статус.");
  if (!(await run("UPDATE inquiries SET status = $1 WHERE id = $2", [status, id]))) throw new Error("Заявка не найдена.");
  await audit(actor, "Смена статуса заявки", `Заявка № ${id}: ${status}`);
}

export async function moneySummary() {
  const sales = await one<{ orders: string; total: string }>("SELECT COUNT(*) AS orders, COALESCE(SUM(total_mdl),0) AS total FROM orders WHERE status='issued'");
  const costs = await one<{ gross: string; missing: string }>(
    "SELECT COALESCE(SUM(i.quantity * (i.unit_price_mdl - i.unit_cost_mdl)),0) AS gross, SUM(CASE WHEN i.unit_cost_mdl IS NULL THEN 1 ELSE 0 END) AS missing FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='issued'",
  );
  return {
    orders: Number(sales?.orders ?? 0),
    total: Number(sales?.total ?? 0),
    gross: Number(costs?.gross ?? 0),
    missing: Number(costs?.missing ?? 0),
  };
}

export async function exportOrders() {
  return (await many("SELECT id, status, delivery_title, total_mdl, created_at, phone, name FROM orders ORDER BY id DESC"));
}

export async function listInventory() {
  return (await many("SELECT id, name, price_mdl, stock, photos_json, category_id, part_type_id FROM catalog_products ORDER BY name LIMIT 300"));
}

export async function addStaffInquiry(actor: Staff, input: Record<string, unknown>) {
  const phone = typeof input.phone === "string" ? toInternational(input.phone) : "";
  const part = typeof input.part === "string" ? input.part.trim() : "";
  const vehicle = typeof input.vehicle === "string" ? input.vehicle.trim() : "";
  if (!/^\+\d{8,15}$/.test(phone) || part.length < 2 || part.length > 160 || vehicle.length > 160) throw new Error("Проверьте телефон и деталь.");
  const created = await one<{ id: number }>(
    "INSERT INTO inquiries (phone, part, vehicle, source, created_at) VALUES ($1,$2,$3,'expert',$4) RETURNING id",
    [phone, part, vehicle, new Date().toISOString()],
  );
  await audit(actor, "Новое обращение", `№ ${created?.id}`);
}

export async function listCosts() {
  return (await many("SELECT id, name, price_mdl, cost_mdl FROM catalog_products ORDER BY name LIMIT 300"));
}

export async function setCost(actor: Staff, id: string, cost: number) {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Неверная себестоимость.");
  if (!(await run("UPDATE catalog_products SET cost_mdl = $1 WHERE id = $2", [cost, id]))) throw new Error("Товар не найден.");
  await audit(actor, "Правка себестоимости", `${id}: ${cost} L.`);
}

export async function updateSettings(actor: Staff, input: Record<string, unknown>) {
  const current = await getSettings();
  const address = input.pickupAddress;
  const pickupHours = input.pickupHours;
  const operatorHours = input.operatorHours;
  const rate = input.rubPerMdl === "" ? null : Number(input.rubPerMdl);
  // Срок возврата б/у детали в днях: на карточке «Возврат N дня». Пусто — оставить прежний.
  const returnDays = input.returnDays === undefined || input.returnDays === "" ? current.returnDays : Number(input.returnDays);
  if (!Number.isInteger(returnDays) || returnDays < 0 || returnDays > 60) throw new Error("Срок возврата — от 0 до 60 дней.");
  const phonePmr = input.phonePmr;
  const phoneMoldova = input.phoneMoldova;
  const viber = input.viberUrl;
  const telegram = input.telegramUrl;
  if (typeof address !== "string" || !address.trim() || address.length > 200 || typeof pickupHours !== "string" || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(pickupHours) || typeof operatorHours !== "string" || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(operatorHours) || (rate !== null && (!Number.isFinite(rate) || rate <= 0 || rate > 1000))) throw new Error("Проверьте настройки.");
  if (typeof phonePmr !== "string" || typeof phoneMoldova !== "string" || !/^\+\d{8,15}$/.test(normalizePhone(phonePmr)) || !/^\+\d{8,15}$/.test(normalizePhone(phoneMoldova))) throw new Error("Проверьте телефоны.");
  if (typeof viber !== "string" || typeof telegram !== "string" || viber.length > 300 || telegram.length > 300 || (viber && !/^(https:\/\/|viber:\/\/)/i.test(viber)) || (telegram && !/^https:\/\//i.test(telegram))) throw new Error("Проверьте ссылки Viber и Telegram.");
  const socials={...current.socials};for(const key of ['whatsapp','instagram','youtube','messenger'] as const){const value=input[`social_${key}`];if(value===undefined)continue;if(typeof value!=='string'||value.length>300||(value!==''&&!/^https:\/\//i.test(value)))throw new Error('Проверьте ссылки социальных сетей.');socials[key]=value.trim();}
  const line = (value: unknown, fallback: string, limit: number) => (typeof value === "string" ? value.split("\r\n").join("\n").trim().slice(0, limit) : fallback);
  const receipt = {
    header: line(input.receiptHeader, current.receipt.header, 200),
    requisites: line(input.receiptRequisites, current.receipt.requisites, 1000),
    signature: line(input.receiptSignature, current.receipt.signature, 200),
    warranty: line(input.receiptWarranty, current.receipt.warranty, 1000),
    invoiceTitle: line(input.receiptInvoiceTitle, current.receipt.invoiceTitle, 200),
    fiscalNumber: line(input.receiptFiscalNumber, current.receipt.fiscalNumber, 60),
  };
  const next = {
    ...current, pickupAddress: address.trim(), pickupHours, operatorHours,
    operatorStartHour: Number(operatorHours.slice(0, 2)),
    operatorEndHour: Number(operatorHours.split("-")[1]?.slice(0, 2)),
    rubPerMdl: rate,
    returnDays,
    phones: { pmr: normalizePhone(phonePmr), moldova: normalizePhone(phoneMoldova) },
    messengers: { viber, telegram }, socials, receipt,
  };
  if (next.operatorStartHour >= next.operatorEndHour || next.operatorEndHour > 24) throw new Error("Проверьте часы оператора.");
  await run("UPDATE settings SET value = $1 WHERE id = 1", [JSON.stringify(next)]);
  await audit(actor, "Изменение настроек", "Адрес, часы или курс валют");
}

export async function setInventory(actor: Staff, id: string, price: number, stock: number, categoryId?: string | null) {
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) throw new Error("Неверная цена или остаток.");
  const before = await one("SELECT price_mdl, stock, category_id FROM catalog_products WHERE id = $1", [id]);
  if (!before) throw new Error("Товар не найден.");
  await run("UPDATE catalog_products SET price_mdl = $1, stock = $2 WHERE id = $3", [price, stock, id]);
  if (categoryId !== undefined && (before.category_id ?? null) !== categoryId) {
    await run("UPDATE catalog_products SET category_id = $1 WHERE id = $2", [categoryId, id]);
    await audit(actor, "Смена категории детали", `${id}: ${before.category_id ?? "без категории"} → ${categoryId ?? "без категории"}`);
  }
  if (Number(before.price_mdl) !== price) await audit(actor, "Правка цены", `${id}: ${before.price_mdl} → ${price} L.`);
  if (Number(before.stock) !== stock) await audit(actor, "Правка остатка", `${id}: ${before.stock} → ${stock}`);
}

export async function importInventory(actor: Staff, csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length || lines.length > 300) throw new Error("Импорт: от 1 до 300 строк.");
  const rows = lines[0].toLowerCase().replaceAll(" ", "") === "id,price,stock" ? lines.slice(1) : lines;
  if (!rows.length) throw new Error("Нет товаров для импорта.");
  const parsed = rows.map((line) => {
    const [id, priceText, stockText, extra] = line.split(",");
    const price = Number(priceText);
    const stock = Number(stockText);
    if (!id || extra !== undefined || !/^\d+$/.test(priceText ?? "") || !/^\d+$/.test(stockText ?? "") || !Number.isSafeInteger(price) || !Number.isSafeInteger(stock)) throw new Error(`Неверная строка: ${line}`);
    return { id, price, stock };
  });
  if (new Set(parsed.map((row) => row.id)).size !== parsed.length) throw new Error("Повторяется ID товара.");
  await tx(async (client) => {
    for (const row of parsed) {
      const changed = await inTx.run(client, "UPDATE catalog_products SET price_mdl = $1, stock = $2 WHERE id = $3", [row.price, row.stock, row.id]);
      if (!changed) throw new Error(`Не найден товар ${row.id}`);
    }
  });
  await audit(actor, "Импорт склада", `${parsed.length} товаров`);
}

export async function revealPhone(actor: Staff, orderId: number) {
  const row = await one("SELECT phone FROM orders WHERE id = $1", [orderId]);
  if (!row) return null;
  await audit(actor, "Просмотр полного телефона клиента", `Заказ № ${orderId + 1000}`);
  return String(row.phone);
}

export function maskPhone(phone: string) {
  const match = /^(\+373)(\d{2})\d+(\d{2})$/.exec(phone);
  return match ? `${match[1]} ${match[2]} ***${match[3]}` : phone.length > 5 ? `${phone.slice(0, 4)} ***${phone.slice(-2)}` : "***";
}

/* ---------- Повторный ввод пароля перед опасным действием ---------- */

/**
 * Смена ролей и выгрузка заказов с телефонами — действия, которые нельзя
 * отменить одним щелчком. Живая кука для них больше не считается достаточной:
 * у отошедшего от стола владельца ею воспользуется любой, кто сядет за его машину.
 * Поэтому перед такими действиями пароль вводится заново, и отметка живёт недолго.
 */
export const confirmTtlMs = 5 * 60 * 1000;

/** Проверяет пароль сотрудника. У доступа, выданного покупателю, пароль берётся из кабинета. */
export async function checkOwnPassword(staff: Staff, password: string, ip = "local"): Promise<boolean> {
  if (typeof password !== "string" || !password || password.length > 200) return false;
  if (!(await allow("confirm:ip", ip, windows.confirmIp))) return false;
  const row = await one(
    `SELECT u.password_hash, c.password_hash AS customer_hash FROM staff_users u
     LEFT JOIN customers c ON c.id = u.customer_id AND c.active = 1
     WHERE u.id = $1 AND u.active = 1`,
    [staff.id],
  );
  const stored = row?.customer_hash ?? row?.password_hash;
  return verifyPassword(password, String(stored ?? dummyHash)) && Boolean(row);
}

/** Записывает подтверждение. Отметка одноразовая по сроку, не по числу действий. */
export async function recordConfirmation(staff: Staff, scope: string) {
  await run("DELETE FROM staff_confirmations WHERE user_id = $1 AND scope = $2", [staff.id, scope]);
  await run("INSERT INTO staff_confirmations (user_id, scope, at) VALUES ($1,$2,$3)", [staff.id, scope, Date.now()]);
  await audit(staff, "Подтверждение паролем", scope);
}

/**
 * Проверяет подтверждение и тут же его тратит: одно подтверждение — одно действие.
 * Окна в пять минут, в которое помещается сколько угодно смен ролей, быть не должно:
 * отошедшему от стола владельцу хватит и одного случайного нажатия.
 */
export async function consumeConfirmation(staff: Staff, scope: string): Promise<boolean> {
  const row = await one<{ at: string }>(
    "DELETE FROM staff_confirmations WHERE user_id = $1 AND scope = $2 RETURNING at",
    [staff.id, scope],
  );
  return Boolean(row) && Date.now() - Number(row?.at ?? 0) < confirmTtlMs;
}

/** Только проверка, без траты: нужна интерфейсу, чтобы заранее спросить пароль. */
export async function hasConfirmation(staff: Staff, scope: string): Promise<boolean> {
  const row = await one<{ at: string }>(
    "SELECT at FROM staff_confirmations WHERE user_id = $1 AND scope = $2 ORDER BY at DESC LIMIT 1",
    [staff.id, scope],
  );
  return Boolean(row) && Date.now() - Number(row?.at ?? 0) < confirmTtlMs;
}

/** Действия, перед которыми пароль вводится заново. */
export const confirmedActions = new Set(["role", "add-user", "delete-user", "grant-staff", "export"]);

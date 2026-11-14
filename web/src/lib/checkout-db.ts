import "server-only";

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import settingsDefaults from "../../config/checkout-settings.json";
import { homepageSeed } from "@/data/homepage.seed";

type Row = Record<string, string | number | null>;
type Statement = { get(...values: (string | number | null)[]): Row | undefined; all(...values: (string | number | null)[]): Row[]; run(...values: (string | number | null)[]): unknown };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };
type Settings = Omit<typeof settingsDefaults, "rubPerMdl"> & { rubPerMdl: number | null };
export type CheckoutSettings = Settings;
export type OrderLine = { id: string; name: string; quantity: number; unitPriceMdl: number; unitPriceRub: number | null };
export type OrderResult = { number: number; token: string; items: OrderLine[]; totalMdl: number; totalRub: number | null; deliveryTitle: string; paymentTitle: string; operatorMessage: string; viberUrl: string | null; telegramUrl: string | null; status: string };
export type OrderInput = { key: string; name: string; phone: string; contactMethod: string; deliveryMethod: string; address: string; paymentMethod: string; comment: string; agreed: boolean; restrictedAgreed: boolean; items: { id: string; quantity: number }[] };

let database: Database | undefined;
const require = createRequire(import.meta.url);

function db(): Database {
  if (database) return database;
  const directory = path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const connection = new DatabaseSync(path.join(directory, "orders.sqlite"));
  connection.exec(`PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price_mdl INTEGER, price_rub INTEGER, stock INTEGER NOT NULL CHECK(stock >= 0), price_mode TEXT NOT NULL, return_restricted INTEGER NOT NULL DEFAULT 0, cost_mdl INTEGER, product_type TEXT);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, idempotency_key TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL, contact_method TEXT NOT NULL, delivery_method TEXT NOT NULL, delivery_title TEXT NOT NULL, address TEXT NOT NULL, payment_method TEXT NOT NULL, payment_title TEXT NOT NULL, comment TEXT NOT NULL, total_mdl INTEGER NOT NULL, total_rub INTEGER, status TEXT NOT NULL DEFAULT 'received', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price_mdl INTEGER NOT NULL, unit_price_rub INTEGER, unit_cost_mdl INTEGER, PRIMARY KEY(order_id, product_id));
    CREATE TABLE IF NOT EXISTS order_status_history (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, actor_name TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);`);
  if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((column) => column.name === "cost_mdl")) connection.exec("ALTER TABLE catalog_products ADD COLUMN cost_mdl INTEGER");
  if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((column) => column.name === "product_type")) connection.exec("ALTER TABLE catalog_products ADD COLUMN product_type TEXT");
  if (!connection.prepare("PRAGMA table_info(order_items)").all().some((column) => column.name === "unit_cost_mdl")) connection.exec("ALTER TABLE order_items ADD COLUMN unit_cost_mdl INTEGER");
  connection.prepare("INSERT OR IGNORE INTO settings(id,value) VALUES(1,?)").run(JSON.stringify(settingsDefaults));
  const insert = connection.prepare("INSERT OR IGNORE INTO catalog_products(id,name,price_mdl,price_rub,stock,price_mode,return_restricted) VALUES(?,?,?,?,?,?,?)");
  for (const product of [...homepageSeed.popularProducts, ...homepageSeed.recommendedProducts]) {
    insert.run(product.id, product.name, product.priceMdl, product.priceRub ?? null, product.stock ?? 1, product.priceMode, product.returnRestricted ? 1 : 0);
  }
  database = connection;
  return connection;
}

export function getSettings(): CheckoutSettings {
  const stored = JSON.parse(String(db().prepare("SELECT value FROM settings WHERE id=1").get()?.value)) as Partial<CheckoutSettings>;
  const settings = { ...settingsDefaults, ...stored, phones: { ...settingsDefaults.phones, ...stored.phones }, messengers: { ...settingsDefaults.messengers, ...stored.messengers }, receipt: { ...settingsDefaults.receipt, ...stored.receipt } } as CheckoutSettings;
  return { ...settings, deliveryMethods: settings.deliveryMethods.map((method) => method.id === "pickup" ? { ...method, description: `${settings.pickupAddress}, ${settings.pickupHours}` } : method) };
}

export function getCheckoutCatalog() {
  const rate = getSettings().rubPerMdl;
  return db().prepare("SELECT id, name, price_mdl, price_rub, stock, price_mode, return_restricted, product_type FROM catalog_products").all().map((row) => ({
    id: String(row.id), name: String(row.name), priceMdl: row.price_mdl === null ? null : Number(row.price_mdl), priceRub: row.price_rub !== null ? Number(row.price_rub) : rate !== null && rate > 0 && row.price_mdl !== null ? Math.round(Number(row.price_mdl) * rate) : null, stock: Number(row.stock), priceMode: String(row.price_mode), returnRestricted: Boolean(row.return_restricted), productType: row.product_type === null ? null : String(row.product_type),
  }));
}

function localHour(settings: Settings, date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, hour: "2-digit", hourCycle: "h23" }).format(date));
}

function message(settings: Settings, createdAt: string) {
  const hour = localHour(settings, new Date(createdAt));
  return hour < settings.operatorStartHour || hour >= settings.operatorEndHour
    ? `Оператор свяжется с вами утром после ${settings.operatorStartHour}:00 и подтвердит наличие, итог и доставку`
    : `Оператор свяжется с вами с ${settings.operatorHours} и подтвердит наличие, итог и доставку`;
}

function messengerUrl(base: string, number: number) {
  if (!base) return null;
  const url = new URL(base);
  if (!(["https:", "viber:"].includes(url.protocol))) return null;
  url.searchParams.set("text", `Заказ №${number}`);
  return url.toString();
}

function contactUrl(settings: Settings, service: "viber" | "telegram", orderNumber: number) {
  const configured = settings.messengers[service];
  if (configured) return messengerUrl(configured, orderNumber);
  const phone = settings.phones.pmr.replace(/\D/g, "");
  if (!phone) return null;
  const text = `Заказ №${orderNumber}`;
  if (service === "telegram") return `https://t.me/+${phone}?text=${encodeURIComponent(text)}`;
  return `viber://chat?number=${encodeURIComponent(`+${phone}`)}`;
}

function getOrder(where: string, value: string): OrderResult | null {
  const connection = db();
  const row = connection.prepare(`SELECT * FROM orders WHERE ${where}=?`).get(value);
  if (!row) return null;
  const settings = getSettings();
  const number = Number(row.id) + 1000;
  const items = connection.prepare("SELECT product_id, name, quantity, unit_price_mdl, unit_price_rub FROM order_items WHERE order_id=?").all(Number(row.id)).map((item) => ({
    id: String(item.product_id), name: String(item.name), quantity: Number(item.quantity), unitPriceMdl: Number(item.unit_price_mdl), unitPriceRub: item.unit_price_rub === null ? null : Number(item.unit_price_rub),
  }));
  return { number, token: String(row.token), items, totalMdl: Number(row.total_mdl), totalRub: row.total_rub === null ? null : Number(row.total_rub), deliveryTitle: String(row.delivery_title), paymentTitle: String(row.payment_title), operatorMessage: message(settings, String(row.created_at)), viberUrl: contactUrl(settings, "viber", number), telegramUrl: contactUrl(settings, "telegram", number), status: String(row.status) };
}

export function getOrderByToken(token: string) { return getOrder("token", token); }

export class OrderError extends Error {
  constructor(public status: number, public field: string, message: string) { super(message); }
}

export function createOrder(input: OrderInput): OrderResult {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  let committed = false;
  try {
    const previous = getOrder("idempotency_key", input.key);
    if (previous) { connection.exec("COMMIT"); committed = true; return previous; }
    const settings = getSettings();
    const delivery = settings.deliveryMethods.find((option) => option.id === input.deliveryMethod);
    const payment = settings.paymentMethods.find((option) => option.id === input.paymentMethod);
    if (!delivery) throw new OrderError(400, "deliveryMethod", "Выберите способ получения.");
    if (!payment) throw new OrderError(400, "paymentMethod", "Выберите способ оплаты.");
    if (delivery.needsAddress && !input.address.trim()) throw new OrderError(400, "address", "Укажите адрес доставки.");
    if (!input.agreed) throw new OrderError(400, "agreed", "Подтвердите согласие с условиями и политикой.");
    if (!input.items.length || input.items.length > 50 || input.items.some((item) => !item || typeof item.id !== "string") || new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new OrderError(400, "items", "Проверьте состав корзины.");
    const lines: OrderLine[] = [];
    const costs = new Map<string, number | null>();
    let restricted = false;
    for (const item of input.items) {
      if (!item.id || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new OrderError(400, "items", "Проверьте количество товаров.");
      const product = connection.prepare("SELECT * FROM catalog_products WHERE id=?").get(item.id);
      if (!product || product.price_mode !== "fixed" || product.price_mdl === null) throw new OrderError(409, "items", "Один из товаров недоступен. Обновите корзину.");
      if (Number(product.stock) < item.quantity) throw new OrderError(409, "items", `Недостаточно товара «${product.name}». Осталось ${product.stock} шт.`);
      restricted ||= Boolean(product.return_restricted);
      costs.set(item.id, product.cost_mdl === null ? null : Number(product.cost_mdl));
      const rate = settings.rubPerMdl;
      lines.push({ id: item.id, name: String(product.name), quantity: item.quantity, unitPriceMdl: Number(product.price_mdl), unitPriceRub: product.price_rub !== null ? Number(product.price_rub) : rate !== null && rate > 0 ? Math.round(Number(product.price_mdl) * rate) : null });
    }
    if (restricted && !input.restrictedAgreed) throw new OrderError(400, "restrictedAgreed", "Подтвердите условие для двигателя или КПП.");
    const totalMdl = lines.reduce((sum, item) => sum + item.unitPriceMdl * item.quantity, 0);
    const totalRub = lines.every((item) => item.unitPriceRub !== null) ? lines.reduce((sum, item) => sum + (item.unitPriceRub ?? 0) * item.quantity, 0) : null;
    const token = randomUUID();
    connection.prepare("INSERT INTO orders(idempotency_key,token,name,phone,contact_method,delivery_method,delivery_title,address,payment_method,payment_title,comment,total_mdl,total_rub,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(input.key, token, input.name.trim(), input.phone, input.contactMethod, delivery.id, delivery.title, delivery.needsAddress ? input.address.trim() : "", payment.id, payment.title, input.comment.trim(), totalMdl, totalRub, new Date().toISOString());
    const row = connection.prepare("SELECT id FROM orders WHERE token=?").get(token);
    const orderId = Number(row?.id);
    const insertLine = connection.prepare("INSERT INTO order_items(order_id,product_id,name,quantity,unit_price_mdl,unit_price_rub,unit_cost_mdl) VALUES(?,?,?,?,?,?,?)");
    for (const line of lines) insertLine.run(orderId, line.id, line.name, line.quantity, line.unitPriceMdl, line.unitPriceRub, costs.get(line.id) ?? null);
    // Остаток списывается не здесь, а когда оператор подтверждает заказ: до звонка деталь никому не обещана.
    // Поэтому заказ сразу получает первую запись в истории статусов.
    connection.prepare("INSERT INTO order_status_history(order_id,from_status,to_status,actor_name,comment,at) VALUES(?,?,?,?,?,?)")
      .run(orderId, "", "received", "Сайт", "Заказ оформлен покупателем", new Date().toISOString());
    connection.exec("COMMIT");
    committed = true;
    return getOrderByToken(token)!;
  } catch (error) {
    if (!committed) connection.exec("ROLLBACK");
    throw error;
  }
}

import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import settingsDefaults from "../../config/checkout-settings.json";
import { messenger, storeHours } from "@/lib/store-info";
import { homepageSeed } from "@/data/homepage.seed";
import { inTx, many, one, run, txBound } from "@/lib/db";
import { clientDiscount, discountedPrice } from "@/lib/client-pricing";

type Settings = Omit<typeof settingsDefaults, "rubPerMdl"> & { rubPerMdl: number | null };
export type CheckoutSettings = Settings;
export type OrderLine = { id: string; name: string; quantity: number; unitPriceMdl: number; unitPriceRub: number | null };
export type OrderResult = { number: number; token: string; items: OrderLine[]; totalMdl: number; totalRub: number | null; deliveryTitle: string; paymentTitle: string; operatorMessage: string; viberUrl: string | null; telegramUrl: string | null; status: string;
  /** П8: самовывоз или доставка, адрес склада и телефон — для экрана «Заказ получен» и статуса. */
  pickup: boolean; pickupAddress: string; phone: string };
/** Кто оформляет заказ: вошедший покупатель или гостевая сессия браузера.
 *  Ключ идемпотентности действует только внутри своей области. */
export type OrderOwner = { customerId: number | null; guestId: string };
export function ownerScope(owner: OrderOwner) { return owner.customerId ? `c:${owner.customerId}` : `g:${owner.guestId}`; }

export type OrderInput = { key: string; name: string; phone: string; contactMethod: string; deliveryMethod: string; address: string; paymentMethod: string; comment: string; agreed: boolean; restrictedAgreed: boolean; items: { id: string; quantity: number }[] };

// Таблицы создаёт db/schema.sql (npm run db:migrate). Здесь остаётся только наполнение
// значениями по умолчанию: настройки магазина и демонстрационные товары.
// Выполняется один раз на процесс и ничего не перезаписывает.
let seeding: Promise<void> | undefined;

async function seed() {
  await run("INSERT INTO settings (id, value) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(settingsDefaults)]);
  for (const product of [...homepageSeed.popularProducts, ...homepageSeed.recommendedProducts]) {
    await run(
      `INSERT INTO catalog_products (id, name, price_mdl, price_rub, stock, price_mode, return_restricted)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [product.id, product.name, product.priceMdl, product.priceRub ?? null, product.stock ?? 1, product.priceMode, product.returnRestricted ? 1 : 0],
    );
  }
}

export async function ensureSeeded() {
  seeding ??= seed().catch((error) => {
    seeding = undefined;
    throw error;
  });
  return seeding;
}

export async function getSettings(): Promise<CheckoutSettings> {
  await ensureSeeded();
  const row = await one<{ value: string }>("SELECT value FROM settings WHERE id = 1");
  // A damaged settings row must not turn the whole storefront into a 500 page.
  // Defaults keep checkout readable; the owner can then re-save settings in admin.
  let stored: Partial<CheckoutSettings> = {};
  if (row?.value?.trim()) {
    try { stored = JSON.parse(row.value) as Partial<CheckoutSettings>; } catch { stored = {}; }
  }
  const settings = {
    ...settingsDefaults,
    ...stored,
    phones: { ...settingsDefaults.phones, ...stored.phones },
    messengers: { ...settingsDefaults.messengers, ...stored.messengers },
    socials: { ...settingsDefaults.socials, ...stored.socials },
    receipt: { ...settingsDefaults.receipt, ...stored.receipt },
  } as CheckoutSettings;
  return {
    ...settings,
    deliveryMethods: settingsDefaults.deliveryMethods.map((method) => (method.id === "pickup" ? { ...method, description: `${settings.pickupAddress} · склад ${storeHours.warehouse}` } : method)),
  };
}

export async function getCheckoutCatalog(options: { ids?: string[]; rate?: number | null } = {}) {
  if (options.ids?.length === 0) return [];
  const rate = options.rate === undefined ? (await getSettings()).rubPerMdl : options.rate;
  const sql = "SELECT id, name, price_mdl, price_rub, stock, price_mode, return_restricted, product_type FROM catalog_products";
  const rows = options.ids ? await many(sql + " WHERE id = ANY($1::text[])", [options.ids]) : await many(sql);
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    priceMdl: row.price_mdl === null ? null : Number(row.price_mdl),
    // Цена уже в рублях ПМР (П8): отдельный пересчёт не нужен.
    priceRub: null,
    stock: Number(row.stock),
    priceMode: String(row.price_mode),
    returnRestricted: Boolean(Number(row.return_restricted)),
    productType: row.product_type === null ? null : String(row.product_type),
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
  if (!["https:", "viber:"].includes(url.protocol)) return null;
  url.searchParams.set("text", `Заказ №${number}`);
  return url.toString();
}

function contactUrl(settings: Settings, service: "viber" | "telegram", orderNumber: number) {
  const configured = settings.messengers[service];
  if (configured) return messengerUrl(configured, orderNumber);
  const phone = messenger.phone.replace(/\D/g, "");
  const text = `Заказ №${orderNumber}`;
  if (service === "telegram") return `https://t.me/+${phone}?text=${encodeURIComponent(text)}`;
  return `viber://chat?number=${encodeURIComponent(`+${phone}`)}`;
}

async function buildOrder(row: Record<string, unknown> | null, settings: Settings, client?: PoolClient): Promise<OrderResult | null> {
  if (!row) return null;
  const id = Number(row.id);
  const number = id + 1000;
  const sql = "SELECT product_id, name, quantity, unit_price_mdl, unit_price_rub FROM order_items WHERE order_id = $1";
  const rows = client ? await inTx.many(client, sql, [id]) : await many(sql, [id]);
  const items = rows.map((item) => ({
    id: String(item.product_id),
    name: String(item.name),
    quantity: Number(item.quantity),
    unitPriceMdl: Number(item.unit_price_mdl),
    unitPriceRub: item.unit_price_rub === null ? null : Number(item.unit_price_rub),
  }));
  return {
    number,
    token: String(row.token),
    items,
    totalMdl: Number(row.total_mdl),
    // Цены и суммы уже в рублях ПМР — старая «вторая валюта» не показывается.
    totalRub: null,
    deliveryTitle: String(row.delivery_title),
    paymentTitle: String(row.payment_title),
    operatorMessage: message(settings, String(row.created_at)),
    viberUrl: contactUrl(settings, "viber", number),
    telegramUrl: contactUrl(settings, "telegram", number),
    status: String(row.status),
    pickup: String(row.delivery_method ?? "") === "pickup" || String(row.delivery_title).toLowerCase().includes("самовывоз"),
    pickupAddress: settings.pickupAddress,
    phone: settings.phones.pmr || settings.phones.moldova,
  };
}

export async function getOrderByToken(token: string): Promise<OrderResult | null> {
  await ensureSeeded();
  const row = await one("SELECT * FROM orders WHERE token = $1", [token]);
  return (await buildOrder(row, await getSettings()));
}

export class OrderError extends Error {
  constructor(public status: number, public field: string, message: string) { super(message); }
}

export async function createOrder(input: OrderInput, owner: OrderOwner): Promise<OrderResult> {
  await ensureSeeded();
  const settings = await getSettings();
  const scope = ownerScope(owner);
  return (await txBound(async (client) => {
    // Повторная отправка той же формы возвращает прежний заказ, а не создаёт второй.
    // Но только своей сессии: по чужому ключу заказ и его токен не выдаются.
    const previous = await inTx.one(client, "SELECT * FROM orders WHERE idempotency_key = $1", [input.key]);
    if (previous) {
      if (previous.owner_scope !== scope) throw new OrderError(409, "items", "Обновите страницу и оформите заказ заново.");
      return (await buildOrder(previous, settings, client))!;
    }

    const delivery = settings.deliveryMethods.find((option) => option.id === input.deliveryMethod);
    const payment = settings.paymentMethods.find((option) => option.id === input.paymentMethod);
    if (!delivery) throw new OrderError(400, "deliveryMethod", "Выберите способ получения.");
    if (!payment) throw new OrderError(400, "paymentMethod", "Выберите способ оплаты.");
    if (delivery.needsAddress && !input.address.trim()) throw new OrderError(400, "address", "Укажите адрес доставки.");
    if (!input.agreed) throw new OrderError(400, "agreed", "Подтвердите согласие с условиями и политикой.");
    if (!input.items.length || input.items.length > 50 || input.items.some((item) => !item || typeof item.id !== "string") || new Set(input.items.map((item) => item.id)).size !== input.items.length) {
      throw new OrderError(400, "items", "Проверьте состав корзины.");
    }

    const lines: OrderLine[] = [];
    const discount = await clientDiscount(input.phone);
    const costs = new Map<string, number | null>();
    let restricted = false;
    for (const item of input.items) {
      if (!item.id || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new OrderError(400, "items", "Проверьте количество товаров.");
      const product = await inTx.one(client, "SELECT * FROM catalog_products WHERE id = $1", [item.id]);
      if (!product || product.price_mode !== "fixed" || product.price_mdl === null) throw new OrderError(409, "items", "Один из товаров недоступен. Обновите корзину.");
      if (Number(product.stock) < item.quantity) throw new OrderError(409, "items", `Недостаточно товара «${product.name}». Осталось ${product.stock} шт.`);
      restricted ||= Boolean(Number(product.return_restricted));
      costs.set(item.id, product.cost_mdl === null ? null : Number(product.cost_mdl));
      const rate = settings.rubPerMdl;
      lines.push({
        id: item.id,
        name: String(product.name),
        quantity: item.quantity,
        unitPriceMdl: discountedPrice(Number(product.price_mdl),discount),
        unitPriceRub: product.price_rub !== null ? discountedPrice(Number(product.price_rub),discount) : rate !== null && rate > 0 ? Math.round(discountedPrice(Number(product.price_mdl),discount) * rate) : null,
      });
    }
    if (restricted && !input.restrictedAgreed) throw new OrderError(400, "restrictedAgreed", "Подтвердите условие для двигателя или КПП.");

    const totalMdl = lines.reduce((sum, item) => sum + item.unitPriceMdl * item.quantity, 0);
    const totalRub = lines.every((item) => item.unitPriceRub !== null) ? lines.reduce((sum, item) => sum + (item.unitPriceRub ?? 0) * item.quantity, 0) : null;
    const token = randomUUID();
    const now = new Date().toISOString();
    const created = await inTx.one<{ id: number }>(client,
      `INSERT INTO orders (idempotency_key, token, name, phone, contact_method, delivery_method, delivery_title,
         address, payment_method, payment_title, comment, total_mdl, total_rub, created_at, owner_scope, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [input.key, token, input.name.trim(), input.phone, input.contactMethod, delivery.id, delivery.title,
        delivery.needsAddress ? input.address.trim() : "", payment.id, payment.title, input.comment.trim(), totalMdl, totalRub, now,
        scope, owner.customerId],
    );
    // Два одновременных повтора с одним ключом: вставка удалась ровно одной из них,
    // вторая дожидается и забирает уже созданный заказ. Дубля не возникает.
    if (!created) {
      const winner = await inTx.one(client, "SELECT * FROM orders WHERE idempotency_key = $1", [input.key]);
      if (!winner || winner.owner_scope !== scope) throw new OrderError(409, "items", "Обновите страницу и оформите заказ заново.");
      return (await buildOrder(winner, settings, client))!;
    }
    const orderId = Number(created?.id);
    for (const line of lines) {
      await inTx.run(client,
        "INSERT INTO order_items (order_id, product_id, name, quantity, unit_price_mdl, unit_price_rub, unit_cost_mdl) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [orderId, line.id, line.name, line.quantity, line.unitPriceMdl, line.unitPriceRub, costs.get(line.id) ?? null],
      );
    }
    // Остаток списывается не здесь, а когда оператор подтверждает заказ: до звонка деталь никому не обещана.
    // Поэтому заказ сразу получает первую запись в истории статусов.
    await inTx.run(client,
      "INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, comment, at) VALUES ($1,'','received','Сайт','Заказ оформлен покупателем',$2)",
      [orderId, now],
    );
    const row = await inTx.one(client, "SELECT * FROM orders WHERE id = $1", [orderId]);
    return (await buildOrder(row, settings, client))!;
  }));
}

/**
 * Есть ли уже заказ по этому ключу у этого же покупателя.
 *
 * Нужна маршруту оформления: повтор после обрыва связи не должен упираться
 * в предел на число заказов. Человек, у которого трижды оборвался интернет,
 * шлёт ту же форму с тем же ключом — это одна попытка, а не три, и отказ
 * «слишком много запросов» лишил бы его собственного заказа.
 */
export async function orderExistsForOwner(key: string, owner: OrderOwner): Promise<boolean> {
  if (typeof key !== "string" || !key) return false;
  const row = await one<{ owner_scope: string | null }>("SELECT owner_scope FROM orders WHERE idempotency_key = $1", [key]);
  return Boolean(row) && row?.owner_scope === ownerScope(owner);
}

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { chromium } from "playwright";

const db = new DatabaseSync(join(process.cwd(), "data", "orders.sqlite"));
const id = `qa-engine-${randomUUID()}`;
const key = randomUUID();
const base = process.env.BASE_URL ?? "http://localhost:3000";
const input = { key, name: "Тест агрегата", phone: "+37377745636", contactMethod: "call", deliveryMethod: "pickup", address: "", paymentMethod: "receipt", comment: "Проверка", agreed: true, restrictedAgreed: false, items: [{ id, quantity: 1 }] };
let browser;
try {
  await fetch(`${base}/api/checkout/catalog`);
  db.prepare("INSERT INTO catalog_products(id,name,price_mdl,stock,price_mode,return_restricted,product_type) VALUES(?,?,?,?,?,?,?)").run(id, "Двигатель OM651 в сборе", 1000, 1, "fixed", 1, "Двигатель");
  const catalog = await (await fetch(`${base}/api/checkout/catalog`)).json();
  const product = catalog.find((item) => item.id === id);
  if (!product || !product.returnRestricted || product.productType !== "Двигатель") throw new Error("Двигатель отсутствует в каталоге оформления");
  browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((productId) => localStorage.setItem("naa:cart:v1", JSON.stringify([{ id: productId, quantity: 1 }])), id);
  const page = await context.newPage();
  await page.goto(`${base}/checkout`);
  await page.locator('[data-field="restrictedAgreed"] input').waitFor();
  if (!await page.locator('[data-field="restrictedAgreed"]').isVisible()) throw new Error("Галочка для двигателя не показана");
  await context.close();
  const send = (body) => fetch(`${base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const rejected = await send(input);
  if (rejected.status !== 400 || (await rejected.json()).field !== "restrictedAgreed") throw new Error("Сервер пропустил заказ без согласия на невозврат");
  const accepted = await send({ ...input, restrictedAgreed: true });
  if (accepted.status !== 201) throw new Error(`Заказ отклонён: ${accepted.status} ${await accepted.text()}`);
  const order = await accepted.json();
  const duplicate = await (await send({ ...input, restrictedAgreed: true })).json();
  if (duplicate.number !== order.number) throw new Error("Повторная отправка создала дубль");
  console.log(`PASS: Двигатель, галочка, заказ №${order.number}, повтор без дубля`);
} finally {
  if (browser) await browser.close();
  const order = db.prepare("SELECT id FROM orders WHERE idempotency_key=?").get(key);
  if (order) { db.prepare("DELETE FROM order_status_history WHERE order_id=?").run(order.id); db.prepare("DELETE FROM order_items WHERE order_id=?").run(order.id); db.prepare("DELETE FROM orders WHERE id=?").run(order.id); }
  db.prepare("DELETE FROM catalog_products WHERE id=?").run(id);
  db.close();
  console.log("Тестовая деталь и заказ удалены");
}

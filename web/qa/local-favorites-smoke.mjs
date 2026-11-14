import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const browser = await chromium.launch({ channel: "chrome" });
let createdToken;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/favorites", { waitUntil: "networkidle" });
  if (!await page.getByText("Нажмите ♡ на товаре, чтобы сохранить").isVisible()) throw new Error("empty state missing");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const heart = page.getByRole("button", { name: /Добавить .* в избранное/ }).first();
  await heart.click();
  if (await page.getByRole("button", { name: /Убрать .* из избранного/ }).count() < 1) throw new Error("heart not filled");
  await page.goto("http://localhost:3000/favorites", { waitUntil: "networkidle" });
  await page.getByRole("article").first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  if (await page.getByRole("article").count() < 1) throw new Error("favorite lost on reload");
  await page.screenshot({ path: "qa/shots/favorites-390.png", fullPage: true });
  const other = await context.newPage();
  await other.goto("http://localhost:3000/favorites", { waitUntil: "networkidle" });
  await other.getByRole("article").first().waitFor();
  await other.getByRole("button", { name: /Убрать .* из избранного/ }).first().click();
  if (!await page.getByText("Нажмите ♡ на товаре, чтобы сохранить").isVisible()) throw new Error("storage event not synced");
  const response = await page.goto("http://localhost:3000/order/s/00000000-0000-4000-8000-000000000000");
  if (response?.status() !== 404) throw new Error(`unknown order: ${response?.status()}`);
  const catalog = await (await page.request.get("http://localhost:3000/api/checkout/catalog")).json();
  const product = catalog.find((item) => item.priceMode === "fixed" && item.stock > 0 && !item.returnRestricted);
  const orderResponse = await page.request.post("http://localhost:3000/api/orders", { data: {
    key: randomUUID(), name: "Проверка статуса", phone: "+37368123456", contactMethod: "call",
    deliveryMethod: "pickup", address: "", paymentMethod: "receipt", comment: "", agreed: true,
    restrictedAgreed: false, items: [{ id: product.id, quantity: 1 }],
  } });
  if (orderResponse.status() !== 201) throw new Error(`test order: ${orderResponse.status()}`);
  const order = await orderResponse.json();
  createdToken = order.token;
  await page.goto(`http://localhost:3000/order/s/${createdToken}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: `Статус заказа № ${order.number}` }).waitFor();
  if (!await page.getByRole("list", { name: "Этапы заказа" }).getByText("Получен").isVisible()) throw new Error("status missing");
  const main = page.locator("main");
  if (await main.getByText("Проверка статуса").count() || await main.getByText("+37368123456").count()) throw new Error("personal data exposed");
  await page.screenshot({ path: "qa/shots/order-status-390.png", fullPage: true });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.locator("footer > section").first().screenshot({ path: "qa/shots/footer-390.png" });
  console.log("favorites add/reload/new tab/remove, valid status and unknown status 404: OK");
} finally {
  if (createdToken) {
    const db = new DatabaseSync("data/orders.sqlite");
    const order = db.prepare("SELECT id FROM orders WHERE token=?").get(createdToken);
    if (order) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("DELETE FROM order_status_history WHERE order_id=?").run(order.id);
        db.prepare("DELETE FROM order_items WHERE order_id=?").run(order.id);
        db.prepare("DELETE FROM orders WHERE id=?").run(order.id);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
    db.close();
  }
  await browser.close();
}

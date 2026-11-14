import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const browser = await chromium.launch({ channel: "chrome" });
const db = new DatabaseSync("data/orders.sqlite");
let orderToken;
let originalStock;
let selectedId;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const add = page.getByRole("button", { name: "В корзину" }).first();
  await add.click();
  if (!await page.getByRole("button", { name: /Добавить ещё/ }).first().isVisible()) throw new Error("cart control missing");
  selectedId = await page.evaluate(() => JSON.parse(localStorage.getItem("naa:cart:v1"))[0].id);
  originalStock = db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(selectedId).stock;
  db.prepare("UPDATE catalog_products SET stock=0 WHERE id=?").run(selectedId);
  await page.goto("http://localhost:3000/cart", { waitUntil: "networkidle" });
  if (!await page.getByRole("heading", { name: "Корзина" }).isVisible()) throw new Error("cart unavailable");
  if (!await page.getByText("Продано", { exact: true }).isVisible() || !await page.getByRole("link", { name: "Найти похожий" }).isVisible()) throw new Error("sold item not detected");
  await page.getByRole("button", { name: /Удалить/ }).first().click();
  await page.getByRole("button", { name: "Вернуть" }).click();
  if (!await page.getByText("Продано", { exact: true }).isVisible()) throw new Error("sold item undo failed");
  db.prepare("UPDATE catalog_products SET stock=? WHERE id=?").run(originalStock, selectedId);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Удалить/ }).first().click();
  await page.getByRole("button", { name: "Вернуть" }).click();
  await page.getByRole("link", { name: "Оформить заказ" }).click();
  await page.getByRole("heading", { name: "Оформление заказа" }).waitFor();
  await page.locator('input[autocomplete="name"]').fill("Проверка заказа");
  await page.locator('input[autocomplete="tel-national"]').fill("68123456");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await page.getByRole("heading", { name: /Заказ № \d+ получен/ }).waitFor();
  await page.screenshot({ path: "qa/shots/checkout-receipt-390.png", fullPage: true });
  if (!page.url().endsWith("/checkout")) throw new Error("receipt was replaced by status");
  const link = await page.getByRole("link", { name: "Статус заказа" }).getAttribute("href");
  orderToken = link?.split("/").at(-1);
  if (!orderToken) throw new Error("status link missing");
  const statusResponse = await page.goto(`http://localhost:3000/order/s/${orderToken}`, { waitUntil: "networkidle" });
  if (statusResponse?.status() !== 200) throw new Error(`status page ${statusResponse?.status()}: ${(await page.locator("body").innerText()).slice(0, 200)}`);
  await page.getByRole("heading", { name: /Статус заказа №/ }).waitFor();
  console.log("cart add/remove/undo and checkout receipt/status: OK");
  await context.close();
} finally {
  if (selectedId && originalStock !== undefined) db.prepare("UPDATE catalog_products SET stock=? WHERE id=?").run(originalStock, selectedId);
  if (orderToken) {
    const row = db.prepare("SELECT id FROM orders WHERE token=?").get(orderToken);
    if (row) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("DELETE FROM order_status_history WHERE order_id=?").run(row.id);
        db.prepare("DELETE FROM order_items WHERE order_id=?").run(row.id);
        db.prepare("DELETE FROM orders WHERE id=?").run(row.id);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
  }
  db.close();
  await browser.close();
}

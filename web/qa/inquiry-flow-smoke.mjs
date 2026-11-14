import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const browser = await chromium.launch({ channel: "chrome" });
const db = new DatabaseSync("data/orders.sqlite");
const part = "Проверка заявки NAA";
const phone = "+37368123456";
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const expert = page.locator("#expert-panel form");
  await expert.locator('input[autocomplete="tel-national"]').fill("68123456");
  await expert.locator('input[name="part"]').fill(part);
  await expert.getByRole("button", { name: "Отправить заявку" }).click();
  await page.getByText("Заявка принята.").waitFor();
  await page.goto("http://localhost:3000/search?q=unlikely-no-part-xyz", { waitUntil: "networkidle" });
  const empty = page.getByRole("heading", { name: "Эксперт поможет бесплатно" }).locator("..");
  await empty.getByRole("textbox", { name: "Телефон" }).fill(phone);
  await empty.getByRole("textbox", { name: "Что требуется" }).fill(part);
  await empty.getByRole("button", { name: "Оставить заявку" }).click();
  await page.getByRole("heading", { name: "Заявка принята" }).waitFor();
  const rows = db.prepare("SELECT source FROM inquiries WHERE phone=? AND part=?").all(phone, part);
  if (rows.length !== 2 || !rows.some((row) => row.source === "expert") || !rows.some((row) => row.source === "catalog")) throw new Error("inquiries not stored");
  console.log("expert and empty catalog requests saved in SQLite: OK");
} finally {
  db.prepare("DELETE FROM inquiries WHERE phone=? AND part=?").run(phone, part);
  db.close();
  await browser.close();
}

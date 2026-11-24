// Снимок открытого меню каталога — то же место, что на скриншоте владельца.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "qa/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.locator("main").waitFor();

// Кнопка «Каталог» в шапке
await page.getByRole("button", { name: "Каталог", exact: true }).first().click();
await page.getByRole("dialog", { name: "Каталог запчастей" }).waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/menu-closed-panels.png` });

const names = ["Тормозная система", "Оптика", "Электрика", "Автохимия"];
const report = [];
for (const name of names) {
  const toggle = page.getByRole("button", { name: new RegExp(`подкатегории: ${name}$`) });
  const has = (await toggle.count()) > 0;
  report.push(`${name}: кнопка подкатегорий ${has ? "есть" : "ОТСУТСТВУЕТ"}`);
  if (!has) continue;
  await toggle.first().click();
  await page.waitForTimeout(350);
  const links = await page.locator('[role="dialog"] >> xpath=.//div[contains(@class,"absolute")]//a').allInnerTexts();
  report.push(`   подкатегорий показано: ${links.length} — ${links.join(", ")}`);
  await page.screenshot({ path: `${out}/menu-${name.replace(/[^А-Яа-яA-Za-z]/g, "")}.png` });
}

// Куда ведёт «Автохимия»
const avto = page.getByRole("dialog").getByRole("link", { name: "Автохимия", exact: true }).first();
report.push(`Автохимия ведёт на: ${await avto.getAttribute("href")}`);

console.log(report.join("\n"));
await browser.close();

// Снимки после П8–П9: главная, карточка и оформление на 390 и 1440.  node qa/p8p9-shots.mjs
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
for (const width of [390, 1440]) {
  const page = await (await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } })).newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.screenshot({ path: `qa/shots/p9-home-${width}.png`, fullPage: true });
  await page.goto(BASE + "/checkout", { waitUntil: "networkidle" }); await page.screenshot({ path: `qa/shots/p8-checkout-${width}.png` });
  await page.goto(BASE + "/contacts", { waitUntil: "networkidle" }); await page.screenshot({ path: `qa/shots/p9-contacts-${width}.png`, fullPage: true });
}
await browser.close();

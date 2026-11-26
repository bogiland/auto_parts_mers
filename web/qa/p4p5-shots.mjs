// Снимки новых экранов П4–П5 для глазной проверки: подбор на главной, выдача с машиной,
// окно «Узнать цену», пустой поиск.  node qa/p4p5-shots.mjs
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
for (const width of [390, 1440]) {
  const page = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage();
  await page.goto(BASE + "/"); await page.screenshot({ path: `qa/shots/p4-home-${width}.png` });
  await page.goto(`${BASE}/search?car=mercedes-benz/e-klass/w212`); await page.screenshot({ path: `qa/shots/p4-search-car-${width}.png`, fullPage: width === 1440 });
  await page.goto(`${BASE}/products/battery-agm`); await page.locator("[data-price-request]").first().click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `qa/shots/p5-price-dialog-${width}.png` });
  await page.goto(`${BASE}/search?q=A2128200339`); await page.screenshot({ path: `qa/shots/p5-empty-${width}.png`, fullPage: true });
}
await browser.close();

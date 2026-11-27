// Снимки карточки детали после П6–П7: б/у фара W212 без фото, колодки с фото и характеристиками.
//   node qa/p6p7-shots.mjs
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
for (const width of [390, 1440]) {
  const page = await (await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } })).newPage();
  for (const id of ["demo-part-0", "pads-w213", "demo2-part-w212-brakes-0"]) {
    await page.goto(`${BASE}/products/${id}`);
    await page.screenshot({ path: `qa/shots/p7-card-${id}-${width}.png` });
  }
  await page.goto(`${BASE}/catalog/legkovye/tormoznye-diski`);
  await page.screenshot({ path: `qa/shots/p6-discs-${width}.png` });
}
await browser.close();

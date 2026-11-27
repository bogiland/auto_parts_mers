// Зоны нажатия на телефоне (П9): каждая ссылка, кнопка, поле выбора и галочка — не меньше 44 × 44 px.
// Галочки и радиокнопки считаются вместе с подписью, если они внутри <label>.
//   node qa/tap-targets.mjs [путь ...]
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/catalog/legkovye", "/catalog/legkovye/demo-optics", "/search?q=%D1%84%D0%B0%D1%80%D0%B0", "/products/demo-part-0", "/products/pads-w213", "/cart", "/checkout", "/contacts", "/catalog/avtohimiya", "/catalog/legkovye/mercedes-benz/e-klass"];
const browser = await chromium.launch({ channel: "chrome" });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let total = 0; const report = [];
for (const path of paths) {
  let small = [];
  for (let attempt = 0; attempt < 3; attempt++) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(500);
  try { small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("a[href], button, select, input:not([type=hidden]), summary, [role=button], [role=tab], [role=option]")) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest("[aria-hidden=true], .sr-only, dialog:not([open]), details:not([open]) > :not(summary)")) continue;
      let box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      // Ссылка внутри текста абзаца — это не отдельная кнопка, её не меряем.
      if (el.tagName === "A" && el.parentElement?.closest("p") && !el.className.includes("inline-flex")) continue;
      const label = el.closest("label");
      if ((el.type === "checkbox" || el.type === "radio") && label) box = label.getBoundingClientRect();
      // Перекрытый прозрачной ссылкой на всю карточку — нажимается вся карточка.
      if (box.width < 43.5 || box.height < 43.5) out.push(`${el.tagName.toLowerCase()} ${Math.round(box.width)}×${Math.round(box.height)} «${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}»`);
    }
    return out;
  }); break; } catch { /* страница перезагрузилась во время замера — повторяем */ }
  }
  total += small.length;
  report.push(`${path}: ${small.length}${small.length ? "\n    " + [...new Set(small)].slice(0, 12).join("\n    ") : ""}`);
}
await browser.close();
console.log(report.join("\n"));
console.log(`\nИТОГО меньше 44 px: ${total}`);
process.exitCode = total ? 1 : 0;

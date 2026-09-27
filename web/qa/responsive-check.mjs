import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3000/";
const widths = [360, 390, 768, 1024, 1280, 1440];
mkdirSync("qa/shots", { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
let failed = false;

for (const width of widths) {
  const mobile = width < 768;
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);

  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });

  const report = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const inScroller = (element) =>
      !!element.closest(".scroller-x, [data-scroller], [class*='overflow-x-auto'], [class*='overflow-hidden']");
    const offenders = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.right > viewportWidth + 1 && !inScroller(element);
      })
      .filter((element, _, all) => !all.some((parent) => parent !== element && parent.contains(element)))
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const classNames = String(element.className || "").split(" ").slice(0, 3).join(".");
        return `${element.tagName.toLowerCase()}.${classNames} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`;
      });

    const sizes = new Set();
    const weights = new Set();
    document.querySelectorAll("body *").forEach((element) => {
      if (!element.childNodes.length || ![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) return;
      const styles = getComputedStyle(element);
      sizes.add(`${styles.fontSize}/${styles.lineHeight}`);
      weights.add(styles.fontWeight);
    });

    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
      sizes: [...sizes].sort(),
      weights: [...weights].sort(),
    };
  });

  const overflow = report.scrollWidth > report.viewportWidth;
  const badWeights = report.weights.filter((weight) => !["400", "500", "700"].includes(weight));
  const fractionalSizes = report.sizes.filter((size) => /\.\d/.test(size));

  console.log(`\n=== ${width}px ${overflow ? "FAIL: горизонтальный скролл" : "OK"} (scrollWidth ${report.scrollWidth} / viewport ${report.viewportWidth})`);
  if (report.offenders.length) console.log(`  вылезают за экран:\n   - ${report.offenders.join("\n   - ")}`);
  if (badWeights.length) console.log(`  запрещённые веса шрифта: ${badWeights.join(", ")}`);
  if (fractionalSizes.length) console.log(`  дробные размеры/интерлиньяж (не из токенов): ${fractionalSizes.join(", ")}`);
  console.log(`  размеры шрифта на странице: ${report.sizes.join(" ")}`);

  if (overflow || report.offenders.length || badWeights.length) failed = true;

  await page.screenshot({ path: `qa/shots/home-${width}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log(failed ? "\nИТОГ: есть ошибки, см. выше" : "\nИТОГ: всё чисто");
process.exit(failed ? 1 : 0);

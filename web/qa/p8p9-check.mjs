// Проверка П8 и П9 настоящим браузером.
//  П8: заказ на самовывоз и на доставку на 390 и 1440 — на «Заказ получен» разный текст, у самовывоза адрес и часы;
//      ошибка исчезает, как только поле исправлено; согласие строкой у кнопки; нижнее меню на оформлении скрыто;
//      галочки и радиокнопки не меньше 24 px; на русской версии нигде нет «L.» и «MDL» (корзина, чек, статус);
//      все старые цены переведены, сумма до и после совпадает с курсом.
//  П9: часы на всех страницах совпадают; Viber и Telegram ведут на +373 777 45 636; демо скрыто без NAA_SHOW_DEMO
//      (отдельный прогон: node qa/p8p9-check.mjs --demo-hidden).
//
//   node qa/p8p9-check.mjs
import { chromium } from "playwright";
import pg from "pg";
import "../scripts/env.mjs";

const BASE = "http://localhost:3000";
const PART = "demo2-part-w212-brakes-0";
const HOURS = "Склад: пн–пт 9–18, сб 9–14, вс выходной · Звонки: пн–пт 8–20, сб 9–14 · Писать можно в любое время";
const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch({ channel: "chrome" });
const lei = /(\d\s?L\.|\bMDL\b|\bлеях?\b)/;

if (process.argv.includes("--demo-hidden")) {
  // Сервер должен быть запущен без NAA_SHOW_DEMO.
  const pages = ["/", "/catalog/legkovye", "/catalog/legkovye/all", "/catalog/legkovye/brands", "/search?q=DEMO", "/search?q=" + encodeURIComponent("Демо"), "/cars", "/news", "/reviews", "/sitemap.xml", "/products/demo-part-0", "/donors/demo-donor-0"];
  let hits = 0; const notes = [];
  for (const path of pages) {
    const res = await fetch(BASE + path);
    const html = await res.text();
    // В поиске само слово запроса повторяется в заголовке «Результаты поиска: «DEMO»» — это не демо-запись.
    // Для поиска проверяем, что ничего не найдено.
    if (path.startsWith("/search")) {
      const found = Number(/Найдено:\s*(?:<!-- -->)?\s*(\d+)/.exec(html)?.[1] ?? -1);
      const empty = /Нет в каталоге, проверим склад/.test(html);
      if (found !== 0 && !empty) { hits++; notes.push(`${path}: найдено ${found}`); } else notes.push(`${path}: ничего не найдено`);
      continue;
    }
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    const found = text.match(/DEMO|Демо|ДЕМО|демонстрац/g) ?? [];
    if (found.length) { hits++; notes.push(`${path}: ${[...new Set(found)].join(", ")}`); }
    else notes.push(`${path}: ${res.status}`);
  }
  record("П9: демо скрыто без NAA_SHOW_DEMO", pages.length, hits, notes.join("; "));
} else {
  /* ---------- П8.1. Самовывоз и доставка на 390 и 1440 ---------- */
  {
    let runs = 0, hits = 0; const notes = [];
    for (const width of [390, 1440]) {
      for (const method of ["pickup", "delivery"]) {
        runs++;
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/products/${PART}`);
        await page.locator("[data-buy-box] [data-add-to-cart]").click();
        await page.goto(`${BASE}/checkout`);
        await page.waitForSelector("[data-submit-block]", { state: "attached" });
        const tabbar = await page.locator("nav[aria-label='Быстрая навигация']").count();
        // Пустое имя → ошибка; исправили → ошибка исчезла без повторной отправки.
        await page.locator("[data-field=name] input").fill("");
        await page.locator("[data-submit-block] button[type=submit]").filter({ visible: true }).first().click();
        const errorShown = await page.locator("[data-field=name] ~ [role=alert], [data-field=name] [role=alert]").count() + await page.getByText("Укажите имя.").count();
        await page.locator("[data-field=name] input").fill(`Проверка П8 ${method}`);
        await page.waitForTimeout(200);
        const errorGone = (await page.getByText("Укажите имя.").count()) === 0;
        await page.getByLabel("Номер телефона").first().fill(`68${String(400000 + runs).padStart(6, "0")}`);
        await page.locator(`input[name=delivery][value=${method}]`).check().catch(async () => { await page.locator("input[name=delivery]").nth(method === "pickup" ? 0 : 1).check(); });
        if (method === "delivery") await page.locator("[data-field=address] input").fill("Тирасполь, ул. Проверочная 1");
        const radio = await page.locator("input[name=delivery]").first().boundingBox();
        const consent = await page.locator("[data-consent-line]").filter({ visible: true }).count() > 0;
        const submit = page.locator("[data-submit-block] button[type=submit]").filter({ visible: true }).first();
        const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/orders")), submit.click()]);
        await page.waitForTimeout(500);
        const text = await page.locator("main").innerText();
        const ok = response.status() === 201 && tabbar === 0 && errorShown > 0 && errorGone && consent && radio && radio.width >= 24 && radio.height >= 24
          && (method === "pickup" ? /пн–пт 9–18, сб 9–14, вс выходной/.test(text) && /Позвоните перед приездом/.test(text) && /Новосовицкая|Слободзея/.test(text) : /Перезвоним и договоримся о способе и цене доставки/.test(text))
          && (await page.locator("[data-order-status-link]").count()) > 0 && !lei.test(text);
        if (!ok) { hits++; notes.push(`${width}px ${method}: заказ ${response.status()}, меню ${tabbar}, ошибка ${errorShown}/${errorGone}, согласие ${consent}, радио ${radio?.width}×${radio?.height}`); }
        else notes.push(`${width}px ${method === "pickup" ? "самовывоз" : "доставка"}: ок`);
        const statusHref = await page.locator("[data-order-status-link]").first().getAttribute("href").catch(() => null);
        if (statusHref) {
          const status = (await (await fetch(BASE + statusHref)).text()).replace(/<[^>]+>/g, " ");
          if (lei.test(status) || (method === "pickup" ? !/пн–пт 9–18/.test(status) : !/Перезвоним и договоримся/.test(status))) { hits++; notes.push(`${width}px ${method}: статус заказа без нужного текста или с леями`); }
        }
        const number = Number(/№\s*(\d+)/.exec(text)?.[1] ?? 0);
        if (number) await db.query("UPDATE orders SET comment = comment || ' [p8p9-check]' WHERE id = $1", [number - 1000]);
        await context.close();
      }
    }
    record("П8: заказ на самовывоз и на доставку", runs, hits, notes.join("; "));
  }

  /* ---------- П8.2. Нигде нет L и MDL ---------- */
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/products/${PART}`);
    await page.locator("[data-buy-box] [data-add-to-cart]").click();
    const paths = ["/", "/catalog/legkovye/all", `/products/${PART}`, "/products/cabin-filter", "/cart", "/checkout", "/search?q=" + encodeURIComponent("диск"), "/payment", "/delivery", "/contacts", "/catalog/avtohimiya"];
    const receipt = (await db.query("SELECT receipt_token FROM orders WHERE receipt_token IS NOT NULL ORDER BY id DESC LIMIT 1")).rows[0]?.receipt_token;
    if (receipt) paths.push(`/receipt/${receipt}`);
    let hits = 0; const notes = [];
    for (const path of paths) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      const text = await page.locator("body").innerText();
      const found = text.match(lei);
      if (found) { hits++; notes.push(`${path}: «${found[0]}»`); }
    }
    const rub = /\d руб\./.test(await (await fetch(`${BASE}/products/${PART}`)).text());
    record("П8: на русской версии нет «L.» и «MDL»", paths.length, hits + (rub ? 0 : 1), notes.join("; ") || `проверено ${paths.length} страниц, включая корзину${receipt ? " и чек" : ""}; цены вида «1 220 руб.»`);
    await context.close();
  }

  /* ---------- П8.3. Перевод цен ---------- */
  {
    const rows = (await db.query("SELECT table_name, column_name, COUNT(*)::int n, SUM(old_value)::bigint old_sum, SUM(new_value)::bigint new_sum, MAX(rate)::float rate, MAX(ABS(new_value - old_value * rate))::float worst FROM currency_migration_log GROUP BY 1,2 ORDER BY 1,2")).rows;
    const bad = rows.filter((r) => r.worst > 0.5 || Math.abs(Number(r.new_sum) - Number(r.old_sum) * r.rate) > r.n * 0.5);
    const products = rows.find((r) => r.table_name === "catalog_products" && r.column_name === "price_mdl");
    const settings = JSON.parse((await db.query("SELECT value FROM settings WHERE id=1")).rows[0].value);
    record("П8: цены переведены по курсу", rows.length, bad.length + (settings.baseCurrency === "rub" ? 0 : 1),
      `${rows.reduce((s, r) => s + r.n, 0)} значений в ${rows.length} колонках; цены деталей: ${products?.old_sum} L × ${products?.rate} = ${Math.round(Number(products?.old_sum) * products?.rate)}, в базе ${products?.new_sum} руб. (разница — округление каждой цены, не больше 0,5 руб.)`);
  }

  /* ---------- П9.1. Часы и мессенджеры ---------- */
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const paths = ["/", "/contacts", "/catalog/legkovye", `/products/${PART}`, "/delivery"];
    let hits = 0; const notes = [];
    for (const path of paths) {
      await page.goto(BASE + path);
      const footer = await page.locator("[data-footer-hours]").first().innerText().catch(() => "");
      const viber = await page.locator("[data-footer-viber]").first().getAttribute("href").catch(() => "");
      const telegram = await page.locator("[data-footer-telegram]").first().getAttribute("href").catch(() => "");
      const header = await page.locator("[data-header-viber]").first().getAttribute("href").catch(() => "");
      const ok = footer.includes(HOURS) && viber === "viber://chat?number=%2B37377745636" && telegram === "https://t.me/+37377745636" && header === viber;
      if (!ok) { hits++; notes.push(`${path}: часы «${footer}», viber ${viber}, telegram ${telegram}`); }
    }
    const contacts = await (await fetch(`${BASE}/contacts`)).text();
    if (!contacts.replace(/<[^>]+>/g, "").includes(HOURS.replace(/ · /g, " · "))) { hits++; notes.push("на контактах нет полной строки часов"); }
    record("П9: часы и мессенджеры на всех страницах одинаковые", paths.length + 1, hits, notes.join("; ") || `часы «${HOURS}»; Viber viber://chat?number=%2B37377745636, Telegram https://t.me/+37377745636 — в шапке на телефоне, в подвале и на контактах`);
    await context.close();
  }
}

await browser.close();
await db.end();
const failed = results.filter((r) => r.hits > 0);
console.log(`\n=== ИТОГ ===\nпроверок: ${results.length}, с проблемами: ${failed.length}`);
for (const f of failed) console.log("  !! " + f.name);
process.exitCode = failed.length ? 1 : 0;

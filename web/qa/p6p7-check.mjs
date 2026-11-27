// Проверка П6 и П7 настоящим браузером и базой.
//  П6: деталь сохраняется с четырьмя обязательными полями, артикул NAA-… выдан сам; без любого из них — отказ;
//      «Тормозной диск» в форме правки показывает поля шаблона; старая карточка сохраняется без потерь;
//      на карточке таблица характеристик, «Снято с: … W212 2013 2.2 CDI» и кроссы; фильтр по диаметру считает верно;
//      pads-w213 исправлена по номеру A000-420-91-20.
//  П7: карточка W212 на 390 — фото, цена, состояние и кнопка без прокрутки; превью в списке < 15 КБ;
//      ни одна б/у карточка не показывает чужое фото; у мотора и нового фильтра «Возврату не подлежит»,
//      у б/у фары «Возврат 2 дня»; текста ошибки капчи нет в HTML; «Перейти в корзину →» и «Всего 1 шт.».
//
//   node qa/p6p7-check.mjs
import { chromium } from "playwright";
import pg from "pg";
import sharp from "sharp";
import "../scripts/env.mjs";

const BASE = "http://localhost:3000";
const OWNER = "+37360900021";
const SECRET = process.env.NAA_QA_PASSWORD ?? "proverka-p2-2026-stroka";
const TAG = `p67-${Date.now().toString(36)}`;
const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, values = []) => (await db.query(sql, values)).rows;

const jar = new Map();
async function call(path, body, ip = "198.51.100.71") {
  const headers = { Origin: BASE, "x-forwarded-for": ip, "Content-Type": "application/json" };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  for (const raw of res.headers.getSetCookie?.() ?? []) { const [pair] = raw.split(";"); const i = pair.indexOf("="); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const login = await call("/api/staff/login", { phone: OWNER, password: SECRET });
if (login.status !== 200) throw new Error(`Владелец не вошёл: ${login.status}`);

// Первое фото — настоящий снимок тормозного диска из проекта, увеличенный до размера телефонного кадра.
// Остальные — «шумные» кадры 2400×1800: худший случай для сжатия превью.
async function photo(seed) {
  if (seed === 1) return `data:image/jpeg;base64,${(await sharp("public/images/products/brake-disc.png").resize(2400, 2400).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`;
  const noise = Buffer.alloc(240 * 180 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 31 + seed * 97) % 255;
  const jpeg = await sharp(noise, { raw: { width: 240, height: 180, channels: 3 } }).resize(2400, 1800).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
const brand = (await q("SELECT id FROM ref_brands WHERE lower(name) IN ('zimmermann','mercedes-benz','febi') ORDER BY name DESC LIMIT 1"))[0]?.id;
const donor = "demo-donor-0";

/* ---------- П6.1. Четыре обязательных поля ---------- */
const created = [];
{
  const base = { action: "add-part", partTypeId: "type-tormoznye-diski", brandId: brand, photos: [{ src: await photo(1), closeup: false }], price: 1500, donorId: donor, position: "front" };
  const ok = await call("/api/staff/parts", { ...base, oem: "A2124210912", attrs: { diameter_mm: 320, ventilated: "true", thickness_mm: 30 }, crossNumbers: "Zimmermann: 400.3648.20; Brembo: 09.A815.11", conditionNote: `${TAG}: износ 10%, без биения` });
  if (ok.status === 200) created.push(ok.data.id);
  const misses = [];
  for (const [field, patch] of [["тип", { partTypeId: "" }], ["бренд", { brandId: "" }], ["фото", { photos: [] }], ["цена", { price: "" }]]) {
    const res = await call("/api/staff/parts", { ...base, ...patch });
    if (res.status === 200) { misses.push(`без поля «${field}» деталь сохранилась`); created.push(res.data.id); }
  }
  const onRequest = await call("/api/staff/parts", { ...base, price: "", priceOnRequest: true });
  if (onRequest.status === 200) created.push(onRequest.data.id);
  const skuOk = /^NAA-\d{6}$/.test(ok.data.sku ?? "");
  record("П6: сохранение с четырьмя обязательными полями", 6, (ok.status === 200 && skuOk && onRequest.status === 200 ? 0 : 1) + misses.length,
    `с полями: ${ok.status}, артикул ${ok.data.sku}; «по запросу» вместо цены: ${onRequest.status}; ${misses.join("; ") || "без любого из четырёх — отказ с понятным текстом"}`);
}

/* ---------- П6.2. Фильтр по диаметру ---------- */
{
  for (const [index, diameter] of [300, 320].entries()) {
    const res = await call("/api/staff/parts", { action: "add-part", partTypeId: "type-tormoznye-diski", brandId: brand, photos: [{ src: await photo(10 + index), closeup: false }], price: 900 + index, donorId: donor, position: "rear", attrs: { diameter_mm: diameter } });
    if (res.status === 200) created.push(res.data.id);
  }
  const expected = Object.fromEntries((await q("SELECT attrs->>'diameter_mm' d, COUNT(*)::int n FROM catalog_products WHERE hidden=0 AND category_id='cat-tormoznye-diski' AND attrs ? 'diameter_mm' GROUP BY 1")).map((r) => [r.d, r.n]));
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/catalog/legkovye/tormoznye-diski`);
  // На странице две одинаковые формы фильтра — в колонке и в панели для телефона. Считаем по колонке.
  const shown = await page.$$eval("aside [data-attr-facet=diameter_mm] label", (labels) => labels.map((l) => [l.querySelector("input")?.value, Number(l.querySelector("[data-facet-count]")?.textContent)]));
  const facetOk = shown.length === Object.keys(expected).length && shown.every(([value, count]) => expected[value] === count);
  await page.goto(`${BASE}/catalog/legkovye/tormoznye-diski?a_diameter_mm=320`);
  const html = await page.content();
  const found = Number(/Найдено:\s*(?:<!-- -->)?\s*(\d+)/.exec(html)?.[1] ?? -1);
  const cards = await page.locator("main article").count();
  await browser.close();
  record("П6: фильтр по диаметру", 2, facetOk && found === expected["320"] && cards === found ? 0 : 1,
    `в базе: ${JSON.stringify(expected)}; в фильтре: ${JSON.stringify(shown)}; при 320 мм «Найдено» ${found}, карточек ${cards}`);
}

const browser = await chromium.launch({ channel: "chrome" });

/* ---------- П6.3. Карточка: характеристики, «Снято с», кроссы ---------- */
{
  const id = created[0];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/products/${id}`);
  const specs = await page.$$eval("[data-specs] [data-spec]", (rows) => rows.map((row) => row.textContent));
  const origin = await page.locator("[data-origin]").textContent().catch(() => "");
  const cross = await page.locator("[data-cross]").textContent().catch(() => "");
  const oem = await page.locator("[data-specs]").textContent();
  const ok = specs.some((s) => /Диаметр\s*320 мм/.test(s)) && specs.some((s) => /Вентилируемый\s*да/.test(s)) && /W212 2013 2\.2 CDI/.test(origin) && /400\.3648\.20 \(Zimmermann\)/.test(cross) && /A2124210912/.test(oem);
  record("П6: таблица характеристик, «Снято с» и кроссы на карточке", 1, ok ? 0 : 1, `характеристики: ${specs.join(" | ")}; ${origin?.replace(/\s+/g, " ")}; ${cross?.replace(/\s+/g, " ")}`);
  await page.close();
}

/* ---------- П6.4. Форма правки: диск показывает поля шаблона, старая карточка сохраняется без потерь ---------- */
{
  const columns = "name,name_ro,sku,oem_number,price_mdl,price_mode,stock,condition,location,includes,applicability,brand_id,attrs::text,cross_numbers::text,condition_note,photos_json,category_id,part_type_id,donor_id,return_restricted,hidden";
  const before = (await q(`SELECT ${columns} FROM catalog_products WHERE id='demo-part-0'`))[0];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/inventory`);
  const search = page.getByLabel("Поиск по деталям");
  await search.fill(created[0] ? (await q("SELECT sku FROM catalog_products WHERE id=$1", [created[0]]))[0].sku : "");
  await page.locator(".admin-part-row").first().getByLabel("Изменить").click();
  const discFields = await page.$$eval("[data-attr-fields] [name^=attr_]", (els) => els.map((el) => el.getAttribute("name")));
  await page.getByLabel("Закрыть").first().click();
  await search.fill("DEMO-0001");
  await page.locator(".admin-part-row").first().getByLabel("Изменить").click();
  const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/staff/parts")), page.getByRole("button", { name: "Сохранить", exact: true }).click()]);
  const after = (await q(`SELECT ${columns} FROM catalog_products WHERE id='demo-part-0'`))[0];
  const changed = Object.keys(before).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  const ok = ["attr_diameter_mm", "attr_thickness_mm", "attr_ventilated", "attr_holes", "attr_center_mm"].every((name) => discFields.includes(name)) && response.status() === 200 && changed.length === 0;
  record("П6: форма — поля диска; старая карточка сохраняется без потерь", 2, ok ? 0 : 1, `поля у диска: ${discFields.join(", ")}; сохранение старой карточки: ${response.status()}, изменилось полей: ${changed.length}${changed.length ? ` (${changed.join(", ")})` : ""}`);
  await context.close();
}

/* ---------- П6.5. pads-w213 по номеру ---------- */
{
  const html = await (await fetch(`${BASE}/products/pads-w213`)).text();
  const text = html.replace(/<[^>]*>/g, " ");
  const ok = /Mercedes 190 \(W201\)/.test(text) && /A000-420-91-20/.test(text) && /P 50 011 \(Brembo\)/.test(text) && !/W213/.test(text.replace(/pads-w213/g, ""));
  record("П6: pads-w213 исправлена по номеру", 1, ok ? 0 : 1, ok ? "название и применимость — W201, OEM A000-420-91-20, кросс Brembo P 50 011; W213 на карточке не упоминается" : "карточка не исправлена");
}

/* ---------- П7.1. W212 на 390: фото, цена, состояние и кнопка без прокрутки ---------- */
{
  let hits = 0; const notes = [];
  for (const height of [844, 740]) {
    const page = await browser.newPage({ viewport: { width: 390, height } });
    await page.goto(`${BASE}/products/${created[0]}`);
    const inView = async (selector) => { const box = await page.locator(selector).first().boundingBox(); return Boolean(box && box.y >= 0 && box.y + box.height <= height); };
    const visible = { фото: await inView("main img"), цена: await inView("[data-buy-box] .text-price"), состояние: await inView("[data-condition]"), кнопка: (await inView("[data-buy-box] [data-add-to-cart]")) || (await inView("[data-sticky-buy] [data-add-to-cart]")) };
    const missing = Object.entries(visible).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length) { hits++; notes.push(`390×${height}: ниже первого экрана — ${missing.join(", ")}`); } else notes.push(`390×${height}: всё на первом экране`);
    await page.close();
  }
  record("П7: карточка W212 на 390 без прокрутки", 2, hits, notes.join("; "));
}

/* ---------- П7.2. Фото: имя, три размера, превью < 15 КБ ---------- */
{
  const photos = JSON.parse((await q("SELECT photos_json FROM catalog_products WHERE id=$1", [created[0]]))[0].photos_json);
  const first = photos[0] ?? {};
  const sizes = {};
  for (const key of ["src", "preview", "thumb"]) { const res = await fetch(BASE + first[key]); sizes[key] = res.ok ? (await res.arrayBuffer()).byteLength : -1; }
  const dims = {};
  for (const key of ["src", "preview", "thumb"]) { const buffer = Buffer.from(await (await fetch(BASE + first[key])).arrayBuffer()); const meta = await sharp(buffer).metadata(); dims[key] = Math.max(meta.width, meta.height); }
  const named = /^\/uploads\/parts\/tormoznoy-disk-[a-z0-9-]*[a-z0-9]-a2124210912-1(-\d+)?\.webp$/.test(first.src ?? "") && !/--/.test(first.src ?? "");
  // Худший случай — «шумный» кадр последней проверочной детали: его превью тоже должно уложиться.
  const noisy = JSON.parse((await q("SELECT photos_json FROM catalog_products WHERE id=$1", [created.at(-1)]))[0].photos_json)[0] ?? {};
  const noisyBytes = (await (await fetch(BASE + noisy.preview)).arrayBuffer()).byteLength;
  const ok = named && sizes.preview > 0 && sizes.preview < 15_000 && noisyBytes < 15_000 && dims.src <= 2000 && dims.preview <= 400 && dims.thumb <= 96;
  record("П7: фото — имя по шаблону, оригинал/превью/миниатюра, превью < 15 КБ", 2, ok ? 0 : 1, `${first.src}; размеры ${JSON.stringify(dims)} px; вес ${JSON.stringify(sizes)} байт; превью «шумного» кадра ${noisyBytes} байт`);
}

/* ---------- П7.3. Ни одна б/у карточка не показывает чужое фото ---------- */
{
  const used = await q("SELECT id FROM catalog_products WHERE hidden=0 AND sku IS NOT NULL AND COALESCE(condition,'') <> 'new'");
  let bad = 0; const examples = [];
  for (const { id } of used) {
    const html = await (await fetch(`${BASE}/products/${id}`)).text();
    const main = html.split("<main")[1]?.split("</main>")[0] ?? "";
    const foreign = /neutral-placeholder|\/images\/products\/(?!no-photo)|\/images\/posts\/|\/demo\/[a-z]+\.svg/.test(main.split("Вместе с этой деталью")[0].split("Ещё с этого донора")[0]);
    if (foreign) { bad++; if (examples.length < 5) examples.push(id); }
  }
  record("П7: б/у карточки без чужих фото", used.length, bad, bad ? `чужое фото: ${examples.join(", ")}` : `проверено карточек: ${used.length}, своих фото или заглушка «Фото пришлём в Viber»`);
}

/* ---------- П7.4. Возврат ---------- */
{
  const lines = {};
  for (const [label, id] of [["мотор", "demo-part-27"], ["новый фильтр", "filter-om654"], ["б/у фара", "demo-part-0"]]) {
    const page = await browser.newPage();
    await page.goto(`${BASE}/products/${id}`);
    lines[label] = (await page.locator("[data-return-line]").textContent().catch(() => "")).replace(/\s+/g, " ").trim();
    await page.close();
  }
  const ok = /^Возврату не подлежит/.test(lines["мотор"]) && /^Возврату не подлежит/.test(lines["новый фильтр"]) && /^Возврат 2 дня/.test(lines["б/у фара"]);
  record("П7: строка возврата", 3, ok ? 0 : 1, Object.entries(lines).map(([k, v]) => `${k}: «${v}»`).join("; "));
}

/* ---------- П7.5. Капча не в HTML, корзина ---------- */
{
  const ids = (await q("SELECT id FROM catalog_products WHERE hidden=0 AND sku IS NOT NULL ORDER BY id LIMIT 40")).map((r) => r.id);
  let captcha = 0;
  for (const id of ids) if ((await (await fetch(`${BASE}/products/${id}`)).text()).includes("Проверка временно недоступна")) captcha++;
  const review = await (await fetch(`${BASE}/api/reviews`)).json();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/products/${created[0]}`);
  await page.locator("[data-buy-box] [data-add-to-cart]").click();
  const goToCart = await page.locator("[data-buy-box] [data-go-to-cart]").isVisible();
  const limit = await page.locator("[data-buy-box] [data-stock-limit]").textContent().catch(() => "");
  await page.close();
  const ok = captcha === 0 && review.mode && goToCart && /Всего 1 шт\./.test(limit ?? "");
  record("П7: капча и корзина", ids.length + 2, ok ? 0 : 1, `карточек с текстом ошибки капчи: ${captcha} из ${ids.length}; проверка отзывов отдаётся: ${review.mode ?? "нет"}; «Перейти в корзину →»: ${goToCart}; при остатке 1: «${limit}»`);
}

/* ---------- W212 → тормоза ---------- */
{
  const html = await (await fetch(`${BASE}/catalog/legkovye/demo-brakes?car=mercedes-benz/e-klass/w212`)).text();
  const found = Number(/Найдено:\s*(?:<!-- -->)?\s*(\d+)/.exec(html)?.[1] ?? -1);
  record("W212 → тормоза", 1, found > 0 ? 0 : 1, `найдено деталей: ${found}`);
}

await browser.close();
// Проверочные детали снимаем с витрины: они помечены «${TAG}» в состоянии и не должны висеть у покупателей.
if (created.length) await q("UPDATE catalog_products SET hidden=1, demo_tag=$2 WHERE id = ANY($1::text[])", [created, TAG]);
await db.end();
const failed = results.filter((r) => r.hits > 0);
console.log(`\n=== ИТОГ ===\nпроверок: ${results.length}, с проблемами: ${failed.length}`);
for (const f of failed) console.log("  !! " + f.name);
console.log(`Проверочные детали (${created.length}) скрыты с витрины и помечены demo_tag = «${TAG}».`);
process.exitCode = failed.length ? 1 : 0;

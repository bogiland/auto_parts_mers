// Экранирование HTML: каждое текстовое поле × 8 вариантов скрипта.
// Данные заводятся через API, затем страницы открываются настоящим браузером:
// если бы хоть один вариант выполнился, он выставил бы window.__xss или открыл диалог.
//
//   node qa/p2-escaping-check.mjs
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = "http://localhost:3000";
const ORIGIN = BASE;
const OWNER = "+37360900021";
const SECRET = process.env.NAA_QA_PASSWORD ?? "proverka-p2-2026-stroka";
const TAG = `xss${Date.now().toString(36)}`;
const mask = (value) => String(value).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");

/** Восемь способов протащить скрипт через текстовое поле. */
const payloads = [
  `<script>window.__xss=1</script>`,
  `<img src=x onerror="window.__xss=1">`,
  `"><svg onload="window.__xss=1">`,
  `'><iframe src="javascript:window.__xss=1"></iframe>`,
  `</textarea><script>window.__xss=1</script>`,
  `<body onload="window.__xss=1">`,
  `<a href="javascript:window.__xss=1">нажми</a>`,
  `<div style="background:url(javascript:window.__xss=1)">x</div>`,
];

const jar = () => ({ cookies: new Map() });
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function call(j, path, init = {}, ip) {
  const headers = { Origin: ORIGIN, ...(init.headers ?? {}) };
  if (ip) headers["x-forwarded-for"] = ip;
  const cookie = [...(j?.cookies ?? [])].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.Cookie = cookie;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}

const owner = jar();
{
  const res = await call(owner, "/api/staff/login", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.21" },
    body: JSON.stringify({ phone: OWNER, password: SECRET }),
  });
  if (res.status !== 200) throw new Error(`Владелец (${mask(OWNER)}) не вошёл: ${res.status}`);
}

/* ---------- 1. Заводим данные ---------- */
// С П6 у детали обязательны тип, бренд, фото и цена — без них сервер её не примет.
const photo = `data:image/png;base64,${(await sharp({ create: { width: 64, height: 48, channels: 3, background: "#888" } }).png().toBuffer()).toString("base64")}`;
const created = { parts: [], brands: [], orders: [], inquiries: [] };
let written = 0, refused = 0;

for (const [index, payload] of payloads.entries()) {
  // Бренд в справочнике: попадает в админку и в фильтр каталога.
  const brand = await call(owner, "/api/staff/reference", {
    method: "POST",
    body: JSON.stringify({ action: "save-brand", name: `${TAG}B${index} ${payload}`, description: payload }),
  });
  if (brand.status === 200) { created.brands.push((await brand.json()).id); written++; } else refused++;

  // Деталь: название, место на складе, что входит, применимость — всё видно и на витрине, и в админке.
  const part = await call(owner, "/api/staff/action", {
    method: "POST",
    body: JSON.stringify({
      action: "add-product", name: `${TAG}P${index} ${payload}`, price: 100, stock: 1,
      partTypeId: "type-tormoznye-diski", brandId: "brand-febi", photos: [{ src: photo, closeup: false }],
      location: payload, includes: payload, applicability: payload, conditionNote: payload, condition: "good",
    }),
  });
  if (part.status === 200) { created.parts.push((await part.json())?.id); written++; } else refused++;

  // Заявка эксперту: имя детали и машина уходят в админку и в Telegram-уведомление.
  const inquiry = await call(null, "/api/inquiries", {
    method: "POST",
    headers: { "x-forwarded-for": `198.51.100.${30 + index}` },
    body: JSON.stringify({ phone: `+3736090${String(3000 + index).slice(-4)}`, part: `${TAG}I${index} ${payload}`, vehicle: payload, source: "expert" }),
  });
  if (inquiry.status === 201) { created.inquiries.push((await inquiry.json()).id); written++; } else refused++;
}

// Заказы: имя, адрес и комментарий попадают в админку, в чек и в выгрузку CSV.
for (const [index, payload] of payloads.entries()) {
  const buyer = jar();
  const ip = `198.51.100.${60 + index}`;
  await call(buyer, "/checkout", {}, ip);
  const res = await call(buyer, "/api/orders", {
    method: "POST",
    body: JSON.stringify({
      key: crypto.randomUUID(), name: `${TAG}O${index} ${payload}`, phone: `+3736090${String(4000 + index).slice(-4)}`,
      contactMethod: "call", deliveryMethod: "delivery", address: `${payload} Слободзея`, paymentMethod: "receipt",
      comment: payload, agreed: true, restrictedAgreed: true, items: [{ id: "demo-part-49", quantity: 1 }],
    }),
  }, ip);
  if (res.status === 201) { created.orders.push((await res.json()).number); written++; } else refused++;
}

console.log(`Заведено записей: ${written}, отклонено: ${refused}`);
console.log(`Детали: ${created.parts.length}, бренды: ${created.brands.length}, заявки: ${created.inquiries.length}, заказы: ${created.orders.length}`);

/* ---------- 2. Открываем страницы браузером ---------- */
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Браузеру отдаём ту же сессию владельца, чтобы открылась и админка.
await context.addCookies([...owner.cookies].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" })));

const problems = [];
let visited = 0;

async function inspect(path, label) {
  const page = await context.newPage();
  let fired = false;
  page.on("dialog", async (dialog) => { fired = true; await dialog.dismiss(); });
  page.on("pageerror", () => { /* ошибки страницы сами по себе не признак выполнения скрипта */ });
  await page.addInitScript(() => { window.__xss = 0; });
  await page.goto(BASE + path, { waitUntil: "load" }).catch(() => {});
  await page.waitForTimeout(700);
  const flag = await page.evaluate(() => window.__xss).catch(() => 0);
  // Отдельно смотрим, не появился ли в документе живой элемент из полезной нагрузки.
  // Текст полезной нагрузки встречается в служебном потоке Next как обычная строка данных —
  // это не выполнение. Считаем только скрипт, вставленный целиком, то есть ровно тот, что в нагрузке.
  const injected = await page.evaluate(() => ({
    scripts: [...document.querySelectorAll("script")].filter((s) => (s.textContent ?? "").trim() === "window.__xss=1").length,
    frames: [...document.querySelectorAll("iframe")].filter((f) => (f.getAttribute("src") ?? "").startsWith("javascript:")).length,
    handlers: [...document.querySelectorAll("[onerror],[onload]")].filter((e) => (e.getAttribute("onerror") ?? e.getAttribute("onload") ?? "").includes("__xss")).length,
    links: [...document.querySelectorAll("a[href^='javascript:']")].length,
  })).catch(() => ({ scripts: 0, frames: 0, handlers: 0, links: 0 }));
  visited++;
  const total = Number(flag) + injected.scripts + injected.frames + injected.handlers + injected.links + (fired ? 1 : 0);
  if (total > 0) problems.push(`${label} (${path}): флаг ${flag}, скриптов ${injected.scripts}, фреймов ${injected.frames}, обработчиков ${injected.handlers}, ссылок ${injected.links}, диалогов ${fired ? 1 : 0}`);
  console.log(`  ${label.padEnd(26)} ${path.padEnd(42)} ${total === 0 ? "чисто" : "!! " + total}`);
  await page.close();
}

console.log("\n### Витрина\n");
await inspect(`/search?q=${encodeURIComponent(TAG)}`, "поиск по метке");
await inspect("/catalog/legkovye", "каталог");
await inspect("/", "главная");
for (const id of created.parts.slice(0, 3)) if (id) await inspect(`/products/${id}`, "карточка детали");

console.log("\n### Админка\n");
for (const [path, label] of [
  ["/admin/inventory", "детали"],
  ["/admin/orders", "заказы"],
  ["/admin/requests", "обращения"],
  ["/admin/reference", "справочники"],
  ["/admin/journal", "журнал"],
  ["/admin/clients", "клиенты"],
]) await inspect(path, label);

/* ---------- 3. Выгрузка CSV ---------- */
console.log("\n### Выгрузка\n");
{
  await call(owner, "/api/staff/confirm", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.22" },
    body: JSON.stringify({ scope: "export", password: SECRET }),
  });
  const res = await call(owner, "/api/staff/export");
  const text = res.status === 200 ? await res.text() : "";
  // Формула в CSV выполняется в Excel. Опасна первая ячейка строки, начинающаяся с = + @ или минуса.
  const cells = text.split(/\r\n/).flatMap((line) => line.split('","').map((cell) => cell.replace(/^"|"$/g, "")));
  const formulas = cells.filter((cell) => /^[=+@\-\t\r]/.test(cell));
  const rawTags = cells.filter((cell) => /<script|onerror=|onload=|javascript:/i.test(cell)).length;
  visited++;
  if (formulas.length) problems.push(`выгрузка CSV: ячеек, которые Excel выполнит как формулу — ${formulas.length}`);
  console.log(`  статус ${res.status}, ячеек с формулой ${formulas.length}, ячеек с разметкой ${rawTags} (разметка в CSV безопасна: это не HTML)`);
}

await browser.close();

console.log(`\n=== ИТОГ ===\nполей × вариантов: ${payloads.length} вариантов на каждое из полей (бренд, деталь, заявка, заказ — имя, адрес, комментарий, место, что входит, применимость)`);
console.log(`страниц проверено: ${visited} · выполнений скрипта: ${problems.length}`);
for (const line of problems) console.log("  !! " + line);
console.log(`Записи помечены «${TAG}» — по этой метке они находятся для отката в П9.`);
process.exitCode = problems.length ? 1 : 0;

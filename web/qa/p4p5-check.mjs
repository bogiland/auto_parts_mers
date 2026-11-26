// Проверка П4 и П5 настоящим браузером.
//  П4: 10 комбинаций (машина + категория + фильтр + смена фильтра + пустой результат) на 390, 768, 1440;
//      ни одной 404, машина нигде не теряется; от главной до карточки W212 — не больше трёх действий;
//      на 1440 поля фильтра не вылезают за колонку; OEM с дефисами, пробелами и без находится одинаково.
//  П5: «Узнать цену» на трёх деталях → три заявки с деталью, OEM и машиной;
//      пустой поиск по A2128200339 записан в журнал и дал заявку с этим номером;
//      один номер 68123456 принят во всех формах; ночная заявка показывает «Ответим с 8:00».
//
//   node qa/p4p5-check.mjs
import { chromium } from "playwright";
import pg from "pg";
import "../scripts/env.mjs";

const BASE = "http://localhost:3000";
const W212 = "mercedes-benz/e-klass/w212";
const TAG = `p45-${Date.now().toString(36)}`;
const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const browser = await chromium.launch({ channel: "chrome" });

/* ---------- П4.1. Десять комбинаций на трёх ширинах ---------- */
{
  const combos = [
    ["машина → поиск", `/search?car=${W212}`],
    ["машина + категория", `/catalog/legkovye/demo-optics?car=${W212}`],
    ["машина + категория + наличие", `/catalog/legkovye/demo-optics?car=${W212}&availability=in_stock`],
    ["смена фильтра: цена", `/catalog/legkovye/demo-optics?car=${W212}&price_from=100&price_to=999999`],
    ["пустой результат по машине", `/catalog/legkovye/demo-brakes?car=${W212}`],
    ["старый адрес категории", `/catalog/brakes?price_from=100`],
    ["поиск по тексту + машина", `/search?q=${encodeURIComponent("Фара")}&car=${W212}`],
    ["поиск пустой", `/search?q=${encodeURIComponent("zzqx-нет-такого")}`],
    ["машина из куки → категория", `/catalog/legkovye/demo-engine`],
    ["машина из куки → карточка", `/products/demo-part-0`],
  ];
  let runs = 0, hits = 0;
  const notes = [];
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    // Машину выбираем один раз — дальше она должна жить в куке.
    await page.goto(`${BASE}/search?car=${W212}`);
    await page.waitForTimeout(300);
    for (const [label, path] of combos) {
      runs++;
      const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
      const status = response?.status() ?? 0;
      const html = await page.content();
      const bad404 = status === 404 || /This page could not be found/i.test(html);
      // Машина видна плашкой в выдаче и строкой в карточке; пустой поиск без машины её не требует.
      const needsCar = !label.startsWith("старый") && !label.startsWith("поиск пустой");
      const carShown = await page.locator("text=Ваша машина").count() > 0;
      if (bad404 || (needsCar && !carShown)) { hits++; notes.push(`${width}px ${label}: статус ${status}${needsCar && !carShown ? ", машина потерялась" : ""}`); }
    }
    // Фильтр формой: смена галочки и «Показать N» ведут на настоящий адрес, не на 404.
    if (width >= 992) {
      runs++;
      await page.goto(`${BASE}/catalog/legkovye/demo-optics`);
      const form = page.locator("aside form");
      if (await form.count()) {
        await form.locator("input[name=availability]").check();
        await page.waitForTimeout(600);
        await form.locator("button[type=submit]").click();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(500);
        if (!page.url().includes("/catalog/legkovye/demo-optics") || /could not be found/i.test(await page.content())) { hits++; notes.push(`${width}px отправка фильтра ушла на ${page.url()}`); }
      } else { hits++; notes.push(`${width}px нет формы фильтра`); }
    } else {
      runs++;
      await page.goto(`${BASE}/catalog/legkovye/demo-optics`);
      await page.getByRole("button", { name: /^Фильтры/ }).click();
      const sheet = page.locator("#catalog-filter-sheet");
      const buttons = await sheet.locator("button[type=submit]").allTextContents();
      const oldButtons = await sheet.locator("text=/^(Готово|Применить)$/").count();
      await sheet.locator("input[name=availability]").check();
      await page.waitForTimeout(700);
      const label = await sheet.locator("button[type=submit]").textContent();
      await sheet.locator("button[type=submit]").click();
      await page.waitForTimeout(800);
      const ok = buttons.length === 1 && oldButtons === 0 && /Показать \d+/.test(label ?? "") && page.url().includes("availability=in_stock") && page.url().includes("/catalog/legkovye/demo-optics");
      if (!ok) { hits++; notes.push(`${width}px панель фильтров: кнопок ${buttons.length}, старых ${oldButtons}, надпись «${label}», адрес ${page.url()}`); }
    }
    await context.close();
  }
  record("П4: 10 комбинаций × 390/768/1440 + отправка фильтра", runs, hits, notes.join("; ") || "ни одной 404, машина везде на месте, фильтр отправляется на адрес раздела");
}

/* ---------- П4.2. Главная → карточка W212 ---------- */
{
  let runs = 0, hits = 0; const notes = [];
  for (let round = 0; round < 3; round++) {
    runs++;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + "/");
    let actions = 0;
    const picker = page.locator("#car-picker");
    await picker.getByLabel("Марка").selectOption("mercedes-benz"); actions++;
    await picker.getByLabel("Модель").selectOption("e-klass"); actions++;
    await page.waitForURL(/\/search\?car=/, { timeout: 15000 }).catch(() => {});
    const card = page.locator("article a[href^='/products/']").first();
    await card.click(); actions++;
    await page.waitForURL(/\/products\//, { timeout: 15000 }).catch(() => {});
    const onCard = page.url().includes("/products/");
    const donorLine = await page.locator("text=E-класс W212").count();
    if (!onCard || actions > 3 || !donorLine) { hits++; notes.push(`круг ${round + 1}: действий ${actions}, адрес ${page.url()}, упоминаний W212 ${donorLine}`); }
    else notes.push(`круг ${round + 1}: ${actions} действия`);
    await context.close();
  }
  record("П4: от главной до карточки W212", runs, hits, notes.join("; "));
}

/* ---------- П4.3. Колонка фильтров на 1440 ---------- */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const paths = ["/catalog/legkovye/demo-optics", "/search?q=" + encodeURIComponent("фильтр"), "/catalog/legkovye/all"];
  let hits = 0; const notes = [];
  for (const path of paths) {
    await page.goto(BASE + path);
    const overflow = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      if (!aside) return ["нет колонки"];
      const box = aside.getBoundingClientRect();
      return [...aside.querySelectorAll("input,select,button,span,label")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5); })
        .map((el) => el.outerHTML.slice(0, 60));
    });
    if (overflow.length) { hits++; notes.push(`${path}: ${overflow.length} элементов за колонкой`); }
  }
  record("П4: поля фильтра не вылезают за колонку на 1440", paths.length, hits, notes.join("; ") || "все поля внутри колонки");
  await context.close();
}

/* ---------- П4.4. OEM в любом написании ---------- */
{
  const variants = ["A654-094-00-04", "a654 094 00 04", "A6540940004", "a6540940004", "A654.094.00.04"];
  const counts = [];
  for (const q of variants) {
    const html = await (await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`)).text();
    counts.push(Number(/Найдено:\s*(?:<!-- -->)?\s*(\d+)/.exec(html)?.[1] ?? -1));
  }
  const hits = counts.every((n) => n > 0 && n === counts[0]) ? 0 : 1;
  record("П4: поиск OEM с дефисами, пробелами, точками и без", variants.length, hits, variants.map((v, i) => `${v} → ${counts[i]}`).join("; "));
}

/* ---------- П5.1. «Узнать цену» на трёх деталях ---------- */
{
  const priceless = (await db.query(
    "SELECT p.id, p.name, COALESCE(p.oem_number,'') AS oem, d.make||' '||d.model||' '||d.generation AS donor FROM catalog_products p LEFT JOIN donors d ON d.id=p.donor_id WHERE p.hidden=0 AND p.price_mdl IS NULL AND p.stock>0 ORDER BY (p.donor_id IS NULL), p.id LIMIT 3")).rows;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/search?car=${W212}`); // машина в куке — она должна попасть в заявку
  let hits = 0; const notes = [];
  for (const [index, part] of priceless.entries()) {
    await page.goto(`${BASE}/products/${part.id}`);
    await page.locator(`[data-price-request="${part.id}"]`).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel("Номер телефона").fill(`68${String(100000 + index).padStart(6, "0")}`);
    const box = await dialog.boundingBox();
    if (!box || box.y < 0) { hits++; notes.push(`${part.id}: окно уходит за край (${box?.y})`); }
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/inquiries")), dialog.getByRole("button", { name: "Отправить заявку" }).click()]);
    const body = await response.json().catch(() => ({}));
    const row = (await db.query("SELECT part, oem, donor, vehicle, product_id, phone FROM inquiries WHERE id=$1", [body.id ?? 0])).rows[0];
    const crm = (await db.query("SELECT need FROM crm_cases WHERE inquiry_id=$1", [body.id ?? 0])).rows[0];
    const ok = response.status() === 201 && row && row.product_id === part.id && row.part === part.name && row.vehicle.includes("W212") && (!part.oem || row.oem === part.oem) && crm?.need?.includes(part.name) && /^\+37368/.test(row.phone);
    if (!ok) { hits++; notes.push(`${part.id}: статус ${response.status()}, в CRM «${crm?.need ?? "—"}»`); }
    else notes.push(`${part.id} → заявка № ${body.id}, в CRM: «${crm.need}»`);
    await db.query("UPDATE inquiries SET status='closed' WHERE id=$1", [body.id ?? 0]);
  }
  record("П5: «Узнать цену» на трёх деталях", priceless.length, hits, notes.join("; "));
  await context.close();
}

/* ---------- П5.2. Пустой поиск A2128200339 ---------- */
{
  const before = Number((await db.query("SELECT COUNT(*) n FROM search_misses WHERE query='A2128200339'")).rows[0].n);
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/search?q=A2128200339`);
  const block = page.locator("[data-empty-request]");
  const filtersHidden = (await page.locator("aside form").count()) === 0 && (await page.getByLabel("Сортировка товаров").count()) === 0;
  const prefilled = await block.locator("input[name=part]").inputValue();
  await block.getByLabel("Номер телефона").fill("68123456");
  const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith("/api/inquiries")), block.getByRole("button", { name: "Проверить склад" }).click()]);
  const body = await response.json().catch(() => ({}));
  const row = (await db.query("SELECT part, oem, search_query, phone FROM inquiries WHERE id=$1", [body.id ?? 0])).rows[0];
  const after = Number((await db.query("SELECT COUNT(*) n FROM search_misses WHERE query='A2128200339'")).rows[0].n);
  const ok = after > before && filtersHidden && prefilled === "A2128200339" && row?.oem === "A2128200339" && row?.phone === "+37368123456";
  record("П5: пустой поиск по A2128200339", 1, ok ? 0 : 1,
    `журнал: было ${before}, стало ${after}; фильтры и сортировка скрыты: ${filtersHidden}; в форме: «${prefilled}»; заявка № ${body.id ?? "—"}, OEM «${row?.oem ?? "—"}», телефон ${row?.phone?.replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2") ?? "—"}`);
  await db.query("UPDATE inquiries SET status='closed' WHERE id=$1", [body.id ?? 0]);
  await context.close();
}

/* ---------- П5.3. Один номер во всех формах ---------- */
{
  // Номер в местном наборе, как его вводит человек. Каждую форму отправляем через API —
  // так же, как это делает страница: формы шлют номер, собранный полем телефона.
  const local = "68123456";
  const forms = [
    ["заявка эксперту", "/api/inquiries", { phone: local, part: `${TAG} проверка`, vehicle: "", source: "expert" }],
    ["заявка из каталога", "/api/inquiries", { phone: local, part: `${TAG} проверка`, vehicle: "", source: "catalog" }],
    ["отклик на вакансию", "/api/vacancies/apply", { name: `${TAG}`, phone: local, messenger: "phone", about: "", agreed: true }],
    ["заявка на рекламу", "/api/advertising/request", { name: `${TAG}`, phone: local, company: "", slot: "catalog", agreed: true }],
  ];
  let hits = 0; const notes = [];
  for (const [label, path, body] of forms) {
    const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE, "x-forwarded-for": `198.51.100.${200 + forms.indexOf(forms.find((f) => f[0] === label))}` }, body: JSON.stringify(body) });
    const ok = res.status === 200 || res.status === 201;
    if (!ok) hits++;
    notes.push(`${label}: ${res.status}`);
  }
  // Заказ: местный набор тоже принимается.
  const jar = new Map();
  const home = await fetch(`${BASE}/checkout`, { headers: { "x-forwarded-for": "198.51.100.230" } });
  for (const raw of home.headers.getSetCookie?.() ?? []) { const [pair] = raw.split(";"); const i = pair.indexOf("="); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
  const order = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE, "x-forwarded-for": "198.51.100.230", Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify({ key: crypto.randomUUID(), name: `Проверка ${TAG}`, phone: local, contactMethod: "call", deliveryMethod: "pickup", address: "", paymentMethod: "receipt", comment: TAG, agreed: true, restrictedAgreed: true, items: [{ id: "demo-part-49", quantity: 1 }] }) });
  notes.push(`заказ: ${order.status}`);
  if (order.status !== 201) hits++;
  const stored = (await db.query("SELECT DISTINCT phone FROM inquiries WHERE part LIKE $1", [`${TAG}%`])).rows.map((r) => r.phone.replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2"));
  record("П5: номер 68123456 во всех формах", forms.length + 1, hits, `${notes.join("; ")}; в базе заявок номер в виде: ${stored.join(", ")}`);
  // Отзыв требует проверочного вопроса и одной детали на номер — его проверяем разбором номера в unit-тесте не делаем, см. отчёт.
}

/* ---------- П5.4. Ночная заявка ---------- */
{
  // Признак «ночь» считает сервер по времени Кишинёва (unit-тест working-hours.test.ts: 23:00 → ночь).
  // Здесь проверяем, что страница показывает это честно: ответ сервера с afterHours = true.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route("**/api/inquiries", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 0, afterHours: true }) }));
  await page.goto(BASE + "/#expert-request");
  const form = page.locator("#expert-request form");
  await form.getByLabel("Номер телефона").fill("68123456");
  await form.getByLabel("Что ищете").fill("Фара W212");
  await form.getByRole("button", { name: "Отправить заявку" }).click();
  const text = await page.locator("[data-reply-promise]").textContent({ timeout: 5000 }).catch(() => "");
  // И без заполненного поля — своё сообщение, а не системное «Заполните это поле».
  await page.unroute("**/api/inquiries");
  await page.goto(BASE + "/");
  await page.locator("#expert-request form").getByRole("button", { name: "Отправить заявку" }).click();
  const ownError = await page.locator("#expert-request [role=alert]").textContent({ timeout: 3000 }).catch(() => "");
  const ok = /Ответим с 8:00/.test(text ?? "") && Boolean(ownError);
  record("П5: заявка ночью и ошибки своим текстом", 2, ok ? 0 : 1, `подтверждение: «${text}»; пустая форма: «${ownError}»`);
  await context.close();
}

await browser.close();
// Служебные записи проверки закрываем, чтобы они не висели у оператора новыми.
await db.query("UPDATE inquiries SET status='closed' WHERE part LIKE $1", [`${TAG}%`]);
await db.end();
const failed = results.filter((r) => r.hits > 0);
console.log(`\n=== ИТОГ ===\nпроверок: ${results.length}, с проблемами: ${failed.length}`);
for (const f of failed) console.log("  !! " + f.name);
console.log(`Записи проверки помечены «${TAG}».`);
process.exitCode = failed.length ? 1 : 0;

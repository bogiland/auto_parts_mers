// Один остаток на всю витрину (П3).
//  1. Двадцать одновременных заказов на последнюю деталь — продаётся один раз.
//  2. После продажи остаток ноль везде: карточка, поиск, каталог, главная, корзина.
//  3. Десять кругов «подтвердил → отменил → подтвердил» — остаток не уплывает.
//
//   node qa/p3-stock-check.mjs
const BASE = "http://localhost:3000";
const ORIGIN = BASE;
const OWNER = "+37360900021";
const SECRET = process.env.NAA_QA_PASSWORD ?? "proverka-p2-2026-stroka";
// Деталь из блока «Товар недели» на главной: её видно сразу в нескольких местах.
const PART = "cabin-filter";
const mask = (value) => String(value).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");

const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}

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
    headers: { "x-forwarded-for": "198.51.100.31" },
    body: JSON.stringify({ phone: OWNER, password: SECRET }),
  });
  if (res.status !== 200) throw new Error(`Владелец (${mask(OWNER)}) не вошёл: ${res.status}`);
}

/** Остаток из каталога оформления — тот же источник, которым пользуется корзина. */
async function stockFromCheckout() {
  const res = await call(null, `/api/checkout/catalog?ids=${PART}`);
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data) ? data : data.products ?? [];
  return list.find((item) => item.id === PART)?.stock ?? null;
}

async function setStock(value) {
  const res = await call(owner, "/api/staff/action", {
    method: "POST",
    body: JSON.stringify({ action: "inventory", id: PART, price: 540, stock: value }),
  });
  if (res.status !== 200) throw new Error(`Не удалось выставить остаток: ${res.status}`);
}

/** Сколько раз деталь показана «в наличии» на странице. */
async function pageSaysInStock(path) {
  const html = await (await call(null, path)).text();
  const sold = /Продано|Нет в наличии|Нет на складе/i.test(html);
  const available = /В наличии/i.test(html);
  return { sold, available };
}

function orderBody(key, phone) {
  return JSON.stringify({
    key, name: "Проверка П3", phone, contactMethod: "call",
    deliveryMethod: "pickup", address: "", paymentMethod: "receipt",
    comment: "автопроверка П3", agreed: true, restrictedAgreed: true,
    items: [{ id: PART, quantity: 1 }],
  });
}

/* ---------- 1. Двадцать одновременных подтверждений последней детали ---------- */
// Заказ сам по себе остаток не резервирует: оператор перезванивает и подтверждает,
// и только подтверждение списывает деталь со склада. Поэтому гонку надо ловить
// на подтверждении — именно там двадцать заказов спорят за одну деталь.
let soldOrderId = null;
{
  await setStock(1);
  const placed = [];
  for (let i = 0; i < 20; i++) {
    const j = jar();
    const ip = `198.51.100.${100 + i}`;
    await call(j, "/checkout", {}, ip);
    const res = await call(j, "/api/orders", { method: "POST", body: orderBody(crypto.randomUUID(), `+3736090${String(5000 + i).slice(-4)}`) }, ip);
    if (res.status === 201) placed.push((await res.json()).number);
  }
  // Номер в интерфейсе — это идентификатор плюс тысяча.
  const ids = placed.map((number) => Number(number) - 1000);
  const versions = await Promise.all(ids.map(async (id) => {
    const detail = await (await call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-detail", id }) })).json().catch(() => ({}));
    return { id, version: detail.order?.version };
  }));
  const answers = await Promise.all(versions.map(({ id, version }) =>
    call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-status", id, status: "confirmed", version, comment: "автопроверка П3" }) })
      .then(async (res) => ({ id, status: res.status, body: await res.json().catch(() => ({})) }))));

  const confirmed = answers.filter((a) => a.status === 200);
  soldOrderId = confirmed[0]?.id ?? null;
  const left = await stockFromCheckout();
  const bad = confirmed.length === 1 && left === 0 ? 0 : 1;
  const codes = answers.reduce((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});
  record("20 одновременных подтверждений последней детали", 20, bad,
    `оформлено заказов: ${placed.length}; подтверждено: ${confirmed.length} (заказ № ${soldOrderId === null ? "—" : soldOrderId + 1000}); остаток после: ${left}; ответы: ${Object.entries(codes).map(([k, v]) => `${k}×${v}`).join(", ")}`);
}

/* ---------- 2. Остаток ноль во всех местах витрины ---------- */
{
  const places = [
    ["карточка детали", `/products/${PART}`],
    ["поиск", "/search?q=" + encodeURIComponent("Фильтр салона")],
    ["каталог", "/catalog/legkovye/all"],
    ["главная", "/"],
  ];
  const lines = [];
  let wrong = 0;
  const left = await stockFromCheckout();
  lines.push(`каталог оформления (корзина): ${left}`);
  if (left !== 0) wrong++;
  for (const [label, path] of places) {
    const html = await (await call(null, path)).text();
    // Ищем состояние именно этой детали: её идентификатор и соседний признак остатка.
    const slice = html.split(PART).slice(1).join(" ").slice(0, 4000);
    const saysAvailable = /"stock":\s*[1-9]/.test(slice);
    lines.push(`${label}: ${saysAvailable ? "показывает остаток больше нуля" : "остатка нет"}`);
    if (saysAvailable) wrong++;
  }
  record("Остаток ноль везде после продажи", places.length + 1, wrong, lines.join("; "));
}

/* ---------- 3. Десять кругов «подтвердил → отменил» ---------- */
// Отменённый заказ в этой системе окончателен: из «Отмена» переходов нет (orders-db, transitions).
// Поэтому круг делается так, как это происходит в жизни: новый заказ на ту же деталь,
// подтверждение (списание), отмена (возврат остатка) — и так десять раз подряд.
{
  await setStock(1);
  const start = await stockFromCheckout();
  const seen = new Set([start]);
  let rounds = 0, failures = 0;
  const detail = [];
  for (let i = 0; i < 10; i++) {
    const buyer = jar();
    const ip = `198.51.100.${150 + i}`;
    await call(buyer, "/checkout", {}, ip);
    const placed = await call(buyer, "/api/orders", { method: "POST", body: orderBody(crypto.randomUUID(), `+3736090${String(6000 + i).slice(-4)}`) }, ip);
    if (placed.status !== 201) { failures++; detail.push(`круг ${i + 1}: заказ не создан (${placed.status})`); continue; }
    const id = Number((await placed.json()).number) - 1000;

    const first = await (await call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-detail", id }) })).json().catch(() => ({}));
    const confirm = await call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-status", id, status: "confirmed", version: first.order?.version, comment: "автопроверка П3" }) });
    const afterConfirm = await stockFromCheckout();

    const second = await (await call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-detail", id }) })).json().catch(() => ({}));
    const cancel = await call(owner, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-status", id, status: "cancelled", version: second.order?.version, comment: "автопроверка П3: откат круга" }) });
    const afterCancel = await stockFromCheckout();

    rounds++;
    seen.add(afterConfirm); seen.add(afterCancel);
    if (confirm.status !== 200 || cancel.status !== 200) { failures++; detail.push(`круг ${i + 1}: подтверждение ${confirm.status}, отмена ${cancel.status}`); }
    if (afterConfirm !== start - 1) { failures++; detail.push(`круг ${i + 1}: после подтверждения ${afterConfirm}, ждали ${start - 1}`); }
    if (afterCancel !== start) { failures++; detail.push(`круг ${i + 1}: после отмены ${afterCancel}, ждали ${start}`); }
  }
  record("10 кругов «подтвердил → отменил» на одной детали", rounds, failures,
    `остаток в начале ${start}, встречавшиеся значения: ${[...seen].sort().join(", ")}, остаток в конце ${await stockFromCheckout()}${detail.length ? "; " + detail.join("; ") : ""}`);
}



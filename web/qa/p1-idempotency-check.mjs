// Проверки П1. Запускается против локального сервера на 3000.
// Телефоны в выводе маскируются.
const BASE = "http://localhost:3000";
const PRODUCT = "demo-part-49";
const mask = (p) => String(p).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");

const uuid = () => crypto.randomUUID();
const jar = () => ({ cookies: new Map() });
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const header = (j) => [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");

async function call(j, path, init = {}) {
  // Публичные формы принимают запрос только со своей страницы (П2): без Origin будет 403.
  const headers = { Origin: BASE, ...(init.headers ?? {}) };
  const c = header(j);
  if (c) headers.Cookie = c;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}

function orderBody(key, phone = "+37360666853") {
  return JSON.stringify({
    key, name: "Проверка П1", phone, contactMethod: "call",
    deliveryMethod: "pickup", address: "", paymentMethod: "receipt",
    comment: "автопроверка П1", agreed: true, restrictedAgreed: true,
    items: [{ id: PRODUCT, quantity: 1 }],
  });
}

const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits, detail });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}

// Покупатель сначала открывает сайт — там он и получает гостевую сессию.
async function browser() { const j = jar(); await call(j, "/checkout"); return j; }

// --- 1. Повтор оформления 10 раз подряд с одним ключом ---
{
  const j = await browser();
  const key = uuid();
  const numbers = new Set(); let errors = 0;
  for (let i = 0; i < 10; i++) {
    const res = await call(j, "/api/orders", { method: "POST", body: orderBody(key) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 201 && data.number) numbers.add(data.number); else errors++;
  }
  record("Повтор оформления 10 раз подряд, один ключ", 10, numbers.size > 1 ? 1 : 0,
    `создано разных заказов: ${numbers.size} (${[...numbers].join(", ")}), неуспешных ответов: ${errors}`);
}

// --- 2. 10 повторов с обрывом сети ---
{
  const j = await browser();
  const key = uuid();
  const numbers = new Set(); let aborted = 0;
  for (let i = 0; i < 10; i++) {
    const ac = new AbortController();
    // Обрываем запрос почти сразу: сервер уже начал работу, ответ клиент не получил.
    setTimeout(() => ac.abort(), 15);
    try {
      await fetch(BASE + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Cookie: header(j) }, body: orderBody(key), signal: ac.signal });
    } catch { aborted++; }
    const res = await call(j, "/api/orders", { method: "POST", body: orderBody(key) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 201 && data.number) numbers.add(data.number);
  }
  record("10 повторов после обрыва связи, один ключ", 10, numbers.size > 1 ? 1 : 0,
    `оборвано запросов: ${aborted}; создано разных заказов: ${numbers.size} (${[...numbers].join(", ")})`);
}

// --- 3. 20 параллельных повторов одним ключом из двух сессий ---
{
  const a = await browser(), b = await browser();
  // Разводим сессии: каждая получает свою гостевую куку на первом заказе.
  await call(a, "/api/orders", { method: "POST", body: orderBody(uuid()) });
  await call(b, "/api/orders", { method: "POST", body: orderBody(uuid()) });
  const key = uuid();
  const calls = [];
  for (let i = 0; i < 20; i++) calls.push(call(i % 2 === 0 ? a : b, "/api/orders", { method: "POST", body: orderBody(key) }));
  const settled = await Promise.all(calls);
  const bodies = await Promise.all(settled.map((r) => r.json().catch(() => ({}))));
  const fromA = new Set(), fromB = new Set(); let refused = 0;
  settled.forEach((res, i) => {
    const owner = i % 2 === 0 ? fromA : fromB;
    if (res.status === 201 && bodies[i].number) owner.add(bodies[i].number);
    else if (res.status === 409) refused++;
  });
  const shared = [...fromA].filter((n) => fromB.has(n));
  record("20 параллельных повторов одним ключом из двух сессий", 20, shared.length ? 1 : 0,
    `сессия A получила: ${[...fromA].join(", ") || "—"}; сессия B: ${[...fromB].join(", ") || "—"}; отказов 409: ${refused}; общих заказов: ${shared.length}`);
}

console.log("\n===RESULTS===\n" + JSON.stringify(results, null, 1));

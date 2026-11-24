// П1.2 — смена пароля покупателя отзывает и сессию связанного сотрудника.
// Один вход покупателя и один вход сотрудника за круг: иначе упираемся
// в штатную защиту от перебора паролей, а не в проверяемое поведение.
const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const PHONE = "+37360900011";
const EMAIL = "p1-verify@example.invalid";
const mask = (p) => String(p).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const headers = { ...ORIGIN, ...(init.headers ?? {}) };
  const c = j ? header(j) : "";
  if (c) headers.Cookie = c;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}

const rounds = Number(process.argv[2] ?? 6);
let current = process.env.P1_PASS;
if (!current) { console.error("Нужен P1_PASS — текущий пароль тестового кабинета."); process.exit(1); }
let reproduced = 0;
const lines = [];

for (let round = 1; round <= rounds; round++) {
  if (round > 1) await sleep(13_000); // пауза под штатный лимит попыток входа
  const next = `P1-verify-r${round}-${Math.random().toString(36).slice(2, 8)}`;

  const shop = jar();
  const shopLogin = await call(shop, "/api/account", { method: "POST", body: JSON.stringify({ action: "login", login: EMAIL, password: current }) });
  if (shopLogin.status !== 200) { lines.push(`круг ${round}: кабинет не пустил (${shopLogin.status}) — круг не засчитан`); reproduced++; continue; }

  const staff = jar();
  const staffLogin = await call(staff, "/api/staff/login", { method: "POST", body: JSON.stringify({ phone: PHONE, password: current }) });
  if (staffLogin.status !== 200) { lines.push(`круг ${round}: сотрудник не вошёл (${staffLogin.status}) — круг не засчитан`); reproduced++; continue; }

  const before = await call(null, "/api/staff/me", { headers: { Cookie: header(staff) } });
  const changed = await call(shop, "/api/account", { method: "POST", body: JSON.stringify({ action: "password", current, password: next }) });
  const after = await call(null, "/api/staff/me", { headers: { Cookie: header(staff) } });

  const ok = before.status === 200 && changed.status === 200 && after.status === 401;
  if (!ok) reproduced++;
  lines.push(`круг ${round}: сессия сотрудника до смены ${before.status}, смена пароля ${changed.status}, после смены ${after.status} — ${ok ? "отозвана" : "ПРОБЛЕМА"}`);
  if (changed.status === 200) current = next;
}

console.log(`\n### Смена пароля покупателя отзывает сессию сотрудника (${mask(PHONE)})`);
console.log(`  прогонов: ${rounds} · проблема воспроизвелась: ${reproduced}`);
for (const line of lines) console.log("  " + line);
console.log(`\nP1_PASS_NOW=${current}`);

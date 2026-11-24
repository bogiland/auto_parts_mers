// Срок и отзыв ссылки на чек. Прогоняется циклом.
import { execFileSync } from "node:child_process";
const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const PHONE = "+37360900011";
const PASS = process.env.P1_PASS;
const ORDER = Number(process.argv[2]);
const rounds = Number(process.argv[3] ?? 3);

const sql = (q) => execFileSync("docker", ["exec", "naa-postgres", "psql", "-U", "naa", "-d", "naa", "-At", "-c", q], { encoding: "utf8" }).trim();

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

const staff = jar();
const login = await call(staff, "/api/staff/login", { method: "POST", body: JSON.stringify({ phone: PHONE, password: PASS }) });
if (login.status !== 200) { console.error("Сотрудник не вошёл:", login.status); process.exit(1); }

const token = sql(`SELECT receipt_token FROM orders WHERE id=${ORDER}`);
if (!token) { console.error("У заказа нет чека."); process.exit(1); }

let expiredHits = 0, revokedHits = 0;
const lines = [];
for (let round = 1; round <= rounds; round++) {
  // Живая ссылка
  sql(`UPDATE orders SET receipt_revoked=0, receipt_expires_at='2099-01-01T00:00:00.000Z' WHERE id=${ORDER}`);
  const live = await fetch(`${BASE}/receipt/${token}`, { redirect: "manual" });

  // Просроченная
  sql(`UPDATE orders SET receipt_expires_at='2020-01-01T00:00:00.000Z' WHERE id=${ORDER}`);
  const expired = await fetch(`${BASE}/receipt/${token}`, { redirect: "manual" });
  if (expired.status !== 404) expiredHits++;

  // Отозванная штатным действием
  sql(`UPDATE orders SET receipt_expires_at='2099-01-01T00:00:00.000Z' WHERE id=${ORDER}`);
  const detail = await (await call(staff, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "order-detail", id: ORDER }) })).json();
  const revoke = await call(staff, "/api/staff/orders", { method: "POST", body: JSON.stringify({ action: "receipt-revoke", id: ORDER, version: detail.order.version }) });
  const revoked = await fetch(`${BASE}/receipt/${token}`, { redirect: "manual" });
  if (revoked.status !== 404) revokedHits++;

  lines.push(`круг ${round}: живая ${live.status} · просроченная ${expired.status} · отзыв ${revoke.status} → ${revoked.status}`);
}
sql(`UPDATE orders SET receipt_revoked=0, receipt_expires_at='2099-01-01T00:00:00.000Z' WHERE id=${ORDER}`);

console.log(`\n### Срок и отзыв ссылки на чек`);
console.log(`  прогонов: ${rounds} · просроченная открылась: ${expiredHits} · отозванная открылась: ${revokedHits}`);
for (const l of lines) console.log("  " + l);

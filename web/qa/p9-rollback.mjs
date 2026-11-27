// П9: откат тестовых записей по таблице из docs/p0-snimok-i-otkat.md — штатными операциями админки,
// не удалением строк. Так остаток возвращается обратным движением склада, а каждый шаг пишется
// в историю заказа и журнал, как при обычной работе.
//
//   node qa/p9-rollback.mjs            — показать, что будет сделано
//   node qa/p9-rollback.mjs --apply    — выполнить
//
// Только для локальной базы: в ней все заказы созданы аудиторами и проверками (П0), живых покупателей нет.
import pg from "pg";
import "../scripts/env.mjs";

const apply = process.argv.includes("--apply");
const BASE = "http://localhost:3000";
const OWNER = "+37360900021";
const SECRET = process.env.NAA_QA_PASSWORD ?? "proverka-p2-2026-stroka";
const COMMENT = "Откат тестовых записей перед запуском (П9)";
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) { console.error("Не локальная база — откат не выполняется."); process.exit(1); }

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, values = []) => (await db.query(sql, values)).rows;

const jar = new Map();
async function call(path, body) {
  const headers = { Origin: BASE, "x-forwarded-for": "198.51.100.90", "Content-Type": "application/json" };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  for (const raw of res.headers.getSetCookie?.() ?? []) { const [pair] = raw.split(";"); const i = pair.indexOf("="); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const active = await q("SELECT id, status, receipt_token IS NOT NULL AS receipt FROM orders WHERE status IN ('received','confirmed','ready','shipped','issued') ORDER BY id");
const inquiries = await q("SELECT id FROM inquiries WHERE status NOT IN ('closed','ordered','unavailable') ORDER BY id");
const brands = await q("SELECT id FROM ref_brands WHERE name LIKE 'xss%'");
// Детали аудиторов NAA-000036…39 и проверочные детали проверок П2–П7.
const parts = await q("SELECT id FROM catalog_products WHERE hidden = 0 AND (sku IN ('NAA-000036','NAA-000037','NAA-000038','NAA-000039') OR name LIKE 'xss%' OR demo_tag LIKE 'p67-%' OR demo_tag LIKE 'p2p3-%')");
console.log(`Заказов к откату: ${active.length} (выданных — ${active.filter((o) => o.status === "issued").length}); заявок закрыть: ${inquiries.length}; брендов xss удалить: ${brands.length}; деталей скрыть: ${parts.length}`);
if (!apply) { console.log("Это предпросмотр. Выполнить: node qa/p9-rollback.mjs --apply"); await db.end(); process.exit(0); }

const login = await call("/api/staff/login", { phone: OWNER, password: SECRET });
if (login.status !== 200) throw new Error(`Владелец не вошёл: ${login.status}`);
const done = { cancelled: 0, returned: 0, failed: [] };
for (const order of active) {
  const detail = await call("/api/staff/orders", { action: "order-detail", id: order.id });
  let version = detail.data.order?.version;
  if (order.status === "issued") {
    // Выданный заказ: сначала отзываем ссылку на чек, потом «Возврат» — остаток вернётся обратным движением.
    if (order.receipt) { await call("/api/staff/orders", { action: "receipt-revoke", id: order.id, version }); version = (await call("/api/staff/orders", { action: "order-detail", id: order.id })).data.order?.version; }
    const res = await call("/api/staff/orders", { action: "order-status", id: order.id, status: "returned", version, comment: COMMENT });
    if (res.status === 200) done.returned++; else done.failed.push(`${order.id + 1000}: ${res.status} ${res.data.message ?? ""}`);
  } else {
    const res = await call("/api/staff/orders", { action: "order-status", id: order.id, status: "cancelled", version, comment: COMMENT });
    if (res.status === 200) done.cancelled++; else done.failed.push(`${order.id + 1000}: ${res.status} ${res.data.message ?? ""}`);
  }
}
for (const { id } of inquiries) await call("/api/staff/action", { action: "inquiry-status", id, status: "closed" });
for (const { id } of brands) await call("/api/staff/reference", { action: "delete-brand", id });
for (const { id } of parts) await call("/api/staff/parts", { action: "part-hidden", id, hidden: true });
// Журнал пустых поисков проверок — только на локальной базе (так записано в таблице отката).
const misses = await db.query("DELETE FROM search_misses WHERE demo_tag IS NULL AND requested_at >= '2026-11-26'");
console.log(`Отменено: ${done.cancelled}, возвратов: ${done.returned}, ошибок: ${done.failed.length}${done.failed.length ? " — " + done.failed.slice(0, 10).join("; ") : ""}`);
console.log(`Заявок закрыто: ${inquiries.length}; брендов удалено: ${brands.length}; деталей скрыто: ${parts.length}; строк журнала пустых поисков удалено: ${misses.rowCount}`);
await db.end();

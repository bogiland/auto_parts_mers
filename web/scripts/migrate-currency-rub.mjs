// П8: один раз переводит все деньги из леев (L) в рубли ПМР по курсу из настроек.
//
//   npm run migrate:rub              — показать, что будет переведено (ничего не меняет)
//   npm run migrate:rub -- --apply   — перевести
//
// Защита от двойного перевода: после успешного перевода в настройках ставится baseCurrency = "rub",
// и повторный запуск ничего не делает. Каждое старое значение, курс и новое значение пишутся
// в currency_migration_log — по нему перевод проверяется и, если надо, откатывается:
//   UPDATE <таблица> SET <колонка> = old_value ... FROM currency_migration_log ...
// Курс: settings.rates.mdl (руб. ПМР за 1 лей). Если его нет — стартовый курс владельца 0,8414
// из «Ответов владельца» (ПРОЕКТ.md, раздел «Валюта»).
import "./env.mjs";
import pg from "pg";

const apply = process.argv.includes("--apply");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const startRates = { usd: 16.5, eur: 18.71, mdl: 0.8414 };

// Таблица, ключ строки, денежные колонки.
const money = [
  ["catalog_products", "id", ["price_mdl", "cost_mdl"]],
  ["part_offers", "id", ["price_mdl"]],
  ["orders", "id", ["total_mdl", "delivery_cost_mdl"]],
  ["order_items", "order_id::text || ':' || product_id", ["unit_price_mdl", "unit_cost_mdl"]],
  ["order_returns", "id", ["amount_mdl"]],
  ["ad_banners", "id", ["price_mdl"]],
  ["ad_slot_settings", "placement", ["price_mdl"]],
];

await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(hashtext('migrate-currency-rub'))");
  const row = (await db.query("SELECT value FROM settings WHERE id = 1")).rows[0];
  const settings = typeof row?.value === "string" ? JSON.parse(row.value) : row?.value ?? {};
  // Текст страницы «Оплата» говорил про леи — на русской версии их больше нет.
  if (apply) await db.query("UPDATE site_pages SET body_ru = replace(body_ru, $1, $2) WHERE slug = 'payment'", ["Цены указаны в леях (MDL). Если владелец указал курс, рядом показываем сумму в рублях ПМР — это справочный перевод по курсу магазина, а не отдельная цена.", "Все цены на сайте — в рублях ПМР. Точную сумму оператор подтверждает по телефону."]);
  if (apply) await db.query("UPDATE site_pages SET seo_description = replace(seo_description, $1, $2) WHERE slug = 'payment'", ["Цены в леях и рублях ПМР.", "Цены в рублях ПМР."]);
  if (settings.baseCurrency === "rub") { if (apply) await db.query("COMMIT"); console.log("Цены уже в рублях ПМР — перевод был выполнен, повторно не нужен."); if (!apply) await db.query("ROLLBACK"); process.exit(0); }
  const rate = Number(settings.rates?.mdl) > 0 ? Number(settings.rates.mdl) : startRates.mdl;
  console.log(`Курс: 1 лей = ${rate} руб. ПМР${settings.rates?.mdl ? " (из настроек)" : " (стартовый курс владельца)"}`);
  let rows = 0;
  for (const [table, key, columns] of money) {
    const exists = (await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1", [table])).rowCount;
    if (!exists) continue;
    for (const column of columns) {
      const stat = (await db.query(`SELECT COUNT(${column})::int AS n, COALESCE(SUM(${column}),0)::bigint AS total FROM ${table}`)).rows[0];
      console.log(`  ${table}.${column}: ${stat.n} значений, сумма ${stat.total} L → ≈ ${Math.round(Number(stat.total) * rate)} руб.`);
      if (!apply || !stat.n) continue;
      await db.query(
        `INSERT INTO currency_migration_log (table_name,row_id,column_name,old_value,rate,new_value)
         SELECT $1, (${key})::text, $2, ${column}, $3::numeric, ROUND(${column} * $3::numeric)::int FROM ${table} WHERE ${column} IS NOT NULL
         ON CONFLICT DO NOTHING`, [table, column, rate]);
      const updated = await db.query(`UPDATE ${table} SET ${column} = ROUND(${column} * $1::numeric)::int WHERE ${column} IS NOT NULL`, [rate]);
      rows += updated.rowCount;
    }
  }
  if (!apply) { console.log("\nЭто предпросмотр. Перевести: npm run migrate:rub -- --apply"); await db.query("ROLLBACK"); process.exit(0); }
  const next = { ...settings, baseCurrency: "rub", rates: { ...startRates, ...(settings.rates ?? {}), mdl: rate, updatedAt: settings.rates?.updatedAt ?? new Date().toISOString() }, rubPerMdl: null };
  await db.query("UPDATE settings SET value = $1 WHERE id = 1", [JSON.stringify(next)]);
  await db.query("COMMIT");
  console.log(`\nПереведено значений: ${rows}. История — в currency_migration_log.`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await db.end(); }

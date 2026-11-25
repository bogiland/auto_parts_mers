// Склеивает пары карточек «X» и «recommended-X», появившиеся из-за того, что
// рекомендованные детали лежали в наборе отдельными записями с тем же артикулом.
//
//   npm run fix:duplicates
//
// Строки НЕ удаляются: на них могут висеть заказы и движения склада. Дубль
// убирается с витрины (hidden = 1), а его адрес получает постоянную переадресацию
// на основную карточку. Скрипт идемпотентен: повторный запуск ничего не меняет.
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line.replace(/^﻿/, ""));
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) { console.error("Не задан DATABASE_URL. Поднимите базу: npm run db:up"); process.exit(1); }
if (process.env.NAA_DB_READONLY) { console.error("NAA_DB_READONLY задана: запись запрещена."); process.exit(1); }

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

const report = { hidden: [], redirects: [], keptVisible: [], alreadyDone: [] };
try {
  await client.query("BEGIN");
  const { rows } = await client.query(`
    SELECT d.id AS duplicate_id, d.stock AS duplicate_stock, d.hidden AS duplicate_hidden,
           b.id AS base_id, b.name,
           (SELECT count(*) FROM order_items oi WHERE oi.product_id = d.id) AS orders
    FROM catalog_products d
    JOIN catalog_products b ON b.id = replace(d.id, 'recommended-', '')
    WHERE d.id LIKE 'recommended-%'
    ORDER BY d.id`);

  for (const row of rows) {
    const known = await client.query("SELECT product_id FROM product_redirects WHERE old_id = $1", [row.duplicate_id]);
    if (Number(row.duplicate_hidden) === 1 && known.rows[0]) { report.alreadyDone.push(row.duplicate_id); continue; }

    await client.query("UPDATE catalog_products SET hidden = 1 WHERE id = $1", [row.duplicate_id]);
    await client.query(
      "INSERT INTO product_redirects (old_id, product_id, created_at) VALUES ($1,$2,$3) ON CONFLICT (old_id) DO UPDATE SET product_id = EXCLUDED.product_id",
      [row.duplicate_id, row.base_id, new Date().toISOString()]);
    report.hidden.push(`${row.duplicate_id} → ${row.base_id} (${row.name})`);
    report.redirects.push(`${row.duplicate_id} → ${row.base_id}`);
    // Остаток дубля не переносится на основную карточку: это выдумало бы детали,
    // которых на полке нет. Если на дубле что-то числилось, об этом надо знать.
    if (Number(row.duplicate_stock) > 0 || Number(row.orders) > 0) {
      report.keptVisible.push(`${row.duplicate_id}: остаток ${row.duplicate_stock}, заказов ${row.orders} — проверьте вручную`);
    }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(`Скрыто дублей: ${report.hidden.length}`);
for (const line of report.hidden) console.log("  - " + line);
console.log(`Уже было сделано раньше: ${report.alreadyDone.length}`);
if (report.keptVisible.length) {
  console.log("\nТребует внимания владельца (остаток или заказы на дубле):");
  for (const line of report.keptVisible) console.log("  ! " + line);
}

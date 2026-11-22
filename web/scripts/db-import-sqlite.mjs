// Разовый перенос данных из первой версии на SQLite в Postgres.
// Идентификаторы сохраняются как есть, иначе разъедутся номера заказов и ссылки на кабинеты.
// Запускать после npm run db:migrate. Повторный запуск не плодит дубли: строки вставляются
// с ON CONFLICT DO NOTHING.
//
//   npm run db:import
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();
const file = path.join("data", "orders.sqlite");
if (!existsSync(file)) {
  console.log("Файла data/orders.sqlite нет — переносить нечего.");
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Не задан DATABASE_URL.");
  process.exit(1);
}

const sqlite = new DatabaseSync(file, { readOnly: true });
const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

// Порядок важен: сначала то, на что ссылаются. Категории идут отдельно — у них ссылка на саму себя.
const plan = [
  ["settings", ["id", "value"]],
  ["customers", ["id", "name", "surname", "email", "phone", "password_hash", "created_at", "active"]],
  ["customer_addresses", ["id", "customer_id", "title", "city", "street", "note", "is_default", "created_at"]],
  ["staff_users", ["id", "name", "phone", "password_hash", "role", "active", "customer_id"]],
  ["staff_audit", ["id", "actor_id", "actor_name", "action", "details", "at"]],
  ["inquiries", ["id", "phone", "part", "vehicle", "source", "status", "created_at"]],
  ["ref_makes", ["id", "name", "logo", "sort_order", "created_at"]],
  ["ref_models", ["id", "make_id", "name", "sort_order", "created_at"]],
  ["ref_generations", ["id", "model_id", "name", "year_from", "year_to", "engines", "sort_order", "created_at"]],
  ["ref_brands", ["id", "name", "logo", "description", "sort_order", "created_at"]],
  ["ref_part_types", ["id", "name_ru", "name_ro", "category_id", "has_side", "has_position", "assembly", "assembly_includes", "return_restricted", "sort_order", "created_at"]],
  ["ref_category_redirects", ["old_slug", "category_id", "at"]],
  ["donors", ["id", "make_id", "model_id", "generation_id", "make", "model", "generation", "year", "engine", "mileage", "note", "photos_json", "visible", "created_at"]],
  ["catalog_products", ["id", "name", "name_ro", "slug", "sku", "price_mdl", "price_rub", "stock", "price_mode", "return_restricted", "cost_mdl", "product_type", "category_id", "part_type_id", "model_id", "donor_id", "condition", "location", "side", "position", "includes", "applicability", "photos_json", "hidden", "created_at", "sold_at"]],
  ["part_offers", ["id", "product_id", "supplier", "supplier_name", "price_mdl", "stock", "lead_days", "created_at"]],
  ["counters", ["name", "value"]],
  ["orders", ["id", "idempotency_key", "token", "name", "phone", "contact_method", "delivery_method", "delivery_title", "address", "payment_method", "payment_title", "comment", "total_mdl", "total_rub", "status", "created_at", "source", "delivery_cost_mdl", "notes", "against_advice", "version", "stock_written", "cancel_reason", "confirmed_at", "issued_at", "receipt_token", "receipt_at", "receipt_json", "issue_photos_json", "customer_id"]],
  ["order_items", ["order_id", "product_id", "name", "quantity", "unit_price_mdl", "unit_price_rub", "unit_cost_mdl"]],
  ["order_status_history", ["id", "order_id", "from_status", "to_status", "actor_name", "comment", "at"]],
  ["order_returns", ["id", "order_id", "product_id", "product_name", "inspection", "photos_json", "decision", "amount_mdl", "reason", "actor_name", "at"]],
  ["stock_moves", ["id", "product_id", "delta", "reason", "order_id", "actor_name", "note", "at", "undo_until", "undone"]],
  ["site_pages", ["id", "slug", "title_ru", "title_ro", "body_ru", "body_ro", "image", "seo_title", "seo_description", "visible", "show_contacts", "placement", "in_header", "sort_order", "seeded", "created_at"]],
];

// Колонки с автонумерацией: вставляем свои значения и потом двигаем счётчик.
const identity = new Set(["customers", "customer_addresses", "staff_users", "staff_audit", "inquiries", "orders", "order_status_history", "order_returns", "stock_moves"]);

function sqliteColumns(table) {
  try {
    return new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
  } catch {
    return null;
  }
}

async function copy(table, columns) {
  const present = sqliteColumns(table);
  if (!present) {
    console.log(`  ${table}: в SQLite такой таблицы нет — пропускаю`);
    return 0;
  }
  const take = columns.filter((column) => present.has(column));
  if (!take.length) return 0;
  const rows = sqlite.prepare(`SELECT ${take.join(",")} FROM ${table}`).all();
  if (!rows.length) {
    console.log(`  ${table}: пусто`);
    return 0;
  }
  const override = identity.has(table) && take.includes("id") ? " OVERRIDING SYSTEM VALUE" : "";
  const placeholders = take.map((_, index) => `$${index + 1}`).join(",");
  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    const values = take.map((column) => (row[column] === undefined ? null : row[column]));
    // Каждая строка под своей точкой отката: в старой базе остались висячие ссылки на удалённые
    // записи, и одна такая строка не должна рушить весь перенос.
    await client.query("SAVEPOINT row");
    try {
      const result = await client.query(
        `INSERT INTO ${table} (${take.join(",")})${override} VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
      written += result.rowCount ?? 0;
      await client.query("RELEASE SAVEPOINT row");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT row");
      skipped += 1;
      if (skipped <= 3) console.log(`    пропущена строка ${table}: ${error.detail ?? error.message}`);
    }
  }
  console.log(`  ${table}: перенесено ${written} из ${rows.length}${skipped ? `, пропущено ${skipped}` : ""}`);
  return written;
}

try {
  await client.query("BEGIN");

  // Категории: родители раньше детей, иначе ссылка parent_id не найдёт цель.
  const categories = sqliteColumns("ref_categories")
    ? sqlite.prepare("SELECT * FROM ref_categories").all()
    : [];
  const done = new Set();
  let guard = 0;
  while (done.size < categories.length && guard < 10) {
    for (const row of categories) {
      if (done.has(row.id)) continue;
      if (row.parent_id && !done.has(row.parent_id)) continue;
      await client.query(
        `INSERT INTO ref_categories (id,parent_id,slug,name_ru,name_ro,image,intro,seo_title,seo_description,visible,sort_order,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
        [row.id, row.parent_id, row.slug, row.name_ru, row.name_ro, row.image, row.intro, row.seo_title, row.seo_description, row.visible, row.sort_order, row.created_at],
      );
      done.add(row.id);
    }
    guard += 1;
  }
  if (categories.length) console.log(`  ref_categories: перенесено ${done.size} из ${categories.length}`);

  for (const [table, columns] of plan) await copy(table, columns);

  // Счётчики автонумерации нужно подвинуть за максимальный перенесённый id,
  // иначе следующая вставка столкнётся с занятым номером.
  for (const table of identity) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1), true)`,
    );
  }

  await client.query("COMMIT");
  console.log("Перенос завершён.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  sqlite.close();
  await client.end();
}

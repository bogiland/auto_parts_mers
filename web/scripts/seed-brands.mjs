// Справочник брендов новых расходников. Теми же названиями они уже показаны
// на странице направления «Автохимия», но в справочнике их не было —
// значит владелец не мог привязать к ним деталь и поправить описание.
// Скрипт идемпотентен: существующие бренды не трогает, логотипы не затирает.
//
//   npm run seed:brands
import { readFileSync, existsSync } from "node:fs";
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
const url = process.env.DATABASE_URL;
if (!url) { console.error("Не задан DATABASE_URL. Поднимите базу: npm run db:up"); process.exit(1); }

// Список с витрины направления «Автохимия и масла».
const brands = [
  "Addinol", "Areol", "Bardahl", "Castrol", "Comma", "Febi", "Liqui Moly", "Mannol",
  "Motul", "Ravenol", "Sintec", "Total", "Valvoline", "Wolf", "ZIC",
];

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

let added = 0;
let skipped = 0;
try {
  await client.query("BEGIN");
  const { rows } = await client.query("SELECT COALESCE(MAX(sort_order),0) AS last FROM ref_brands");
  let order = Number(rows[0].last);
  for (const name of brands) {
    const existing = await client.query("SELECT id FROM ref_brands WHERE lower(name) = lower($1)", [name]);
    if (existing.rows[0]) { skipped++; continue; }
    order += 1;
    await client.query(
      "INSERT INTO ref_brands (id, name, logo, description, sort_order, created_at) VALUES ($1,$2,'','',$3,$4) ON CONFLICT (id) DO NOTHING",
      [`brand-${slug(name)}`, name, order, new Date().toISOString()]);
    added++;
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(`Добавлено брендов: ${added}; уже были: ${skipped}`);
console.log("Логотипы и описания добавляются в админке: Справочники → Бренды.");

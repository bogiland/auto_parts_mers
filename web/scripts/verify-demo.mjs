import "./env.mjs";
import pg from "pg";

const tag = "naa-demo-v1";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const checks = [
    ["товары", "catalog_products", 50], ["доноры", "donors", 4], ["марки", "ref_makes", 3], ["модели", "ref_models", 5], ["поколения", "ref_generations", 5],
    ["заказы", "orders", 6], ["заявки", "inquiries", 4], ["клиенты", "crm_clients", 3], ["отзывы", "product_reviews", 3], ["статьи", "news_articles", 2],
    ["вакансии", "vacancies", 1], ["отклики", "vacancy_applications", 2], ["баннеры", "ad_banners", 1], ["поиски без результата", "search_misses", 10],
  ];
  for (const [label, table, expected] of checks) {
    const actual = Number((await db.query(`SELECT count(*) AS count FROM ${table} WHERE demo_tag=$1`, [tag])).rows[0].count);
    if (actual !== expected) throw new Error(`${label}: ожидалось ${expected}, получено ${actual}`);
  }
  const details = (await db.query("SELECT count(*) FILTER (WHERE photos_json='[]') AS no_photo, count(*) FILTER (WHERE name_ro='') AS no_ro, count(*) FILTER (WHERE oem_number IS NOT NULL) AS oem FROM catalog_products WHERE demo_tag=$1", [tag])).rows[0];
  if (Number(details.no_photo) !== 5 || Number(details.no_ro) !== 5 || Number(details.oem) < 8) throw new Error(`поля товара: фото=${details.no_photo}, RO=${details.no_ro}, OEM=${details.oem}`);
  const statuses = (await db.query("SELECT status FROM orders WHERE demo_tag=$1 ORDER BY status", [tag])).rows.map((row) => row.status).join(",");
  if (statuses !== "cancelled,confirmed,issued,ready,received,returned") throw new Error(`статусы заказов: ${statuses}`);
  const refs = await db.query("SELECT count(*) AS count FROM donors WHERE demo_tag=$1 AND make_id IS NOT NULL AND model_id IS NOT NULL AND generation_id IS NOT NULL", [tag]);
  if (Number(refs.rows[0].count) !== 4) throw new Error("не у всех доноров есть ссылки на справочники");
  console.log("Демонабор проверен: структура, счётчики, статусы, фото, RO, OEM и связи справочников корректны.");
} finally { await db.end(); }

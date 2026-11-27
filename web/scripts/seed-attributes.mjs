// П6: шаблоны характеристик, расходники, сопутствующие категории.
//
//   npm run seed:attributes          — добавить (повторный запуск ничего не дублирует)
//   npm run seed:attributes -- --clean — убрать только то, что добавил этот скрипт
//
// Значения характеристик у деталей НЕ заполняются выдуманными числами. Исключение —
// стартовые товары, у которых значение уже написано в названии или номере
// («Моторное масло 5W-30, 5 л», «Аккумулятор AGM 95 Ah», «245-45-R18»): его переносим в поле.
import "./env.mjs";
import pg from "pg";

const tag = "p6-structure";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const now = new Date().toISOString();

async function one(sql, values = []) { return (await db.query(sql, values)).rows[0] ?? null; }
async function categoryId(slug) { return (await one("SELECT id FROM ref_categories WHERE slug=$1", [slug]))?.id ?? null; }

/* ---------- Недостающие разделы ---------- */
// В задании есть шаблоны для амортизаторов и для шин с дисками, а таких разделов в справочнике не было.
const newCategories = [
  { id: "cat-podveska", slug: "podveska", name: "Подвеска", parent: null, sort: 70 },
  { id: "cat-amortizatory", slug: "amortizatory", name: "Амортизаторы и стойки", parent: "cat-podveska", sort: 1 },
  { id: "cat-kolesa", slug: "kolesa-i-shiny", name: "Колёса и шины", parent: null, sort: 80 },
];
const newTypes = [
  { id: "type-amortizator", name: "Амортизатор", category: "cat-amortizatory", hasSide: 1, hasPosition: 1 },
  { id: "type-shina", name: "Шина", category: "cat-kolesa", hasSide: 0, hasPosition: 0 },
  { id: "type-kolesnyy-disk", name: "Колёсный диск", category: "cat-kolesa", hasSide: 0, hasPosition: 0 },
  { id: "type-koleso", name: "Колесо в сборе", category: "cat-kolesa", hasSide: 0, hasPosition: 0 },
];

/* ---------- Шаблоны ---------- */
// [ключ, подпись RU, подпись RO, тип, единица, варианты, фильтр, в название]
const T = (key, ru, ro, kind, unit = "", options = [], filterable = false, inName = false) => ({ key, ru, ro, kind, unit, options, filterable, inName });
const templates = [
  // Общие для всех деталей. OEM, кроссы, бренд, донор, сторона и ось, состояние — отдельные поля детали.
  { scope: {}, fields: [
    T("weight_kg", "Вес", "Greutate", "number", "кг"),
    T("length_mm", "Длина", "Lungime", "number", "мм"),
    T("width_mm", "Ширина", "Lățime", "number", "мм"),
    T("height_mm", "Высота", "Înălțime", "number", "мм"),
  ] },
  { scope: { category: "tormoznye-diski" }, fields: [
    T("diameter_mm", "Диаметр", "Diametru", "number", "мм", [], true, true),
    T("thickness_mm", "Толщина", "Grosime", "number", "мм"),
    T("ventilated", "Вентилируемый", "Ventilat", "bool", "", [], true, true),
    T("holes", "Отверстий", "Găuri", "number", "шт."),
    T("center_mm", "Центровка", "Centrare", "number", "мм"),
  ] },
  { scope: { type: "demo-type-brake-pads" }, fields: [
    T("pad_width_mm", "Ширина колодки", "Lățime plăcuță", "number", "мм"),
    T("pad_height_mm", "Высота колодки", "Înălțime plăcuță", "number", "мм"),
    T("pad_thickness_mm", "Толщина колодки", "Grosime plăcuță", "number", "мм"),
    T("wear_sensor", "Датчик износа", "Senzor uzură", "bool", "", [], true),
  ] },
  { scope: { category: "demo-oils" }, fields: [
    T("viscosity", "Вязкость", "Vâscozitate", "list", "", ["0W-20", "0W-30", "0W-40", "5W-20", "5W-30", "5W-40", "10W-40", "15W-40", "75W-90", "80W-90"], true, true),
    T("composition", "Состав", "Compoziție", "list", "", ["Синтетика", "Полусинтетика", "Минеральное"], true),
    T("mb_approval", "Допуск MB", "Aprobare MB", "list", "", ["MB 229.3", "MB 229.31", "MB 229.5", "MB 229.51", "MB 229.52", "MB 229.71"], true),
    T("acea_api", "ACEA / API", "ACEA / API", "text"),
    T("volume_l", "Объём", "Volum", "number", "л", [], true, true),
  ] },
  { scope: { category: "demo-filters" }, fields: [
    T("filter_kind", "Вид фильтра", "Tip filtru", "list", "", ["Масляный", "Воздушный", "Салонный", "Салонный угольный", "Топливный"], true),
    T("engine_codes", "Коды двигателя", "Coduri motor", "text"),
  ] },
  { scope: { category: "akkumulyatory" }, fields: [
    T("capacity_ah", "Ёмкость", "Capacitate", "number", "А·ч", [], true, true),
    T("cold_current_a", "Пусковой ток", "Curent de pornire", "number", "А"),
    T("polarity", "Полярность", "Polaritate", "list", "", ["Обратная (+ справа)", "Прямая (+ слева)"], true),
    T("technology", "Технология", "Tehnologie", "list", "", ["AGM", "EFB", "Обычная"], true, true),
  ] },
  { scope: { category: "kolesa-i-shiny" }, fields: [
    T("tire_size", "Размер шины", "Dimensiune anvelopă", "text", "", [], true, true),
    T("season", "Сезон", "Sezon", "list", "", ["Летняя", "Зимняя", "Всесезонная"], true),
    T("tire_year", "Год выпуска шины", "Anul anvelopei", "number"),
    T("tread_mm", "Остаток протектора", "Profil rămas", "number", "мм"),
    T("rim_diameter", "Диаметр диска", "Diametru jantă", "number", "″", [], true),
    T("et", "Вылет ET", "ET", "number", "мм"),
    T("pcd", "Разболтовка PCD", "PCD", "text", "", [], true),
    T("dia_mm", "Центральное отверстие DIA", "DIA", "number", "мм"),
  ] },
  { scope: { category: "amortizatory" }, fields: [
    T("shock_type", "Тип", "Tip", "list", "", ["Газомасляный", "Масляный", "Пневмостойка"], true),
  ] },
  // Агрегаты: двигатель и КПП в сборе.
  { scope: { type: "demo-type-engine-assembly" }, fields: [
    T("unit_code", "Код агрегата", "Cod agregat", "text", "", [], false, true),
    T("mileage_km", "Пробег", "Kilometraj", "number", "км"),
    T("completeness", "Комплектность", "Completitudine", "text"),
  ] },
  { scope: { type: "demo-type-gearbox" }, fields: [
    T("unit_code", "Код агрегата", "Cod agregat", "text", "", [], false, true),
    T("mileage_km", "Пробег", "Kilometraj", "number", "км"),
    T("completeness", "Комплектность", "Completitudine", "text"),
  ] },
];

/* ---------- Расходники: новый такой — без возврата ---------- */
const consumableCategories = ["demo-filters", "demo-oils", "avtohimiya", "demo-pads", "lampy-i-ksenon"];
const consumableTypes = ["demo-type-brake-pads", "type-lampy-i-ksenon"];

/* ---------- Сопутствующие категории ---------- */
const related = [
  ["tormoznye-diski", "demo-pads"], ["tormoznye-diski", "datchiki-abs"],
  ["demo-pads", "tormoznye-diski"], ["demo-pads", "datchiki-abs"],
  ["motornye-masla", "maslyanye-filtry"], ["demo-oils", "demo-filters"],
  ["maslyanye-filtry", "motornye-masla"], ["amortizatory", "podveska"],
];

/* ---------- Стартовые товары: внутренний артикул отдельно от OEM ---------- */
// Номер, который стоял в «артикуле», — это номер производителя (OEM). Он переезжает в поле OEM,
// а внутренний артикул NAA-… выдаётся из общего счётчика. Значения характеристик — только из названия.
const starters = [
  { id: "pads-w213", oem: "A000-420-91-20", type: "demo-type-brake-pads", category: "demo-pads-front",
    // Номер сверен: по нему это колодки Mercedes W201 (задание владельца), не W213.
    name: "Тормозные колодки передние Mercedes 190 (W201)", fitment: { make: "Mercedes-Benz", model: "190", generation: "W201", note: "По номеру A000-420-91-20. Кросс: Brembo P 50 011" },
    cross: [{ number: "P 50 011", source: "Brembo" }] },
  { id: "filter-om654", oem: "A654-180-01-09", type: "type-maslyanye-filtry", category: "maslyanye-filtry", attrs: { filter_kind: "Масляный" } },
  { id: "air-filter-om654", oem: "A654-094-00-04", type: "type-vozdushnye-filtry", category: "vozdushnye-filtry", attrs: { filter_kind: "Воздушный" } },
  { id: "cabin-filter", oem: "A205-835-01-47", type: "type-salonnye-filtry", category: "salonnye-filtry", attrs: { filter_kind: "Салонный угольный" } },
  { id: "disc-w205", oem: "A000-421-20-12", type: "type-tormoznye-diski", category: "tormoznye-diski" },
  { id: "brake-kit", oem: "A000-420-58-05", type: "type-tormoznye-diski", category: "tormoznye-diski" },
  { id: "battery-agm", oem: "A000-982-31-08", type: "type-akkumulyatory", category: "akkumulyatory", attrs: { capacity_ah: 95, technology: "AGM" } },
  { id: "oil-5w30", oem: "", type: "type-motornye-masla", category: "motornye-masla", attrs: { viscosity: "5W-30", volume_l: 5, mb_approval: "MB 229.52" } },
  { id: "strut-w213", oem: "A213-320-44-30", type: "type-amortizator", category: "amortizatory" },
  { id: "wheel-tire", oem: "", type: "type-koleso", category: "kolesa-i-shiny", attrs: { tire_size: "245/45 R18", rim_diameter: 18 } },
  { id: "plugs-m274", oem: "A004-159-81-03", type: null, category: null },
  { id: "ignition-kit", oem: "A004-159-81-03", type: null, category: null },
];
const starterImages = {
  "pads-w213": "/images/products/brake-pads.png", "filter-om654": "/images/products/oil-filter.png", "air-filter-om654": "/images/products/air-filter.png",
  "cabin-filter": "/images/products/air-filter.png", "disc-w205": "/images/products/brake-disc.png", "brake-kit": "/images/posts/brake-pads.png",
  "battery-agm": "/images/products/battery.png", "oil-5w30": "/images/posts/oil-change.png", "strut-w213": "/images/posts/suspension.png",
  "wheel-tire": "/images/posts/tires.png", "plugs-m274": "/images/products/spark-plugs.png", "ignition-kit": "/images/products/spark-plugs.png",
};

async function nextSku() {
  await db.query("INSERT INTO counters(name,value) VALUES('sku',0) ON CONFLICT (name) DO NOTHING");
  const row = await one("UPDATE counters SET value=value+1 WHERE name='sku' RETURNING value");
  return `NAA-${String(row.value).padStart(6, "0")}`;
}

async function seed() {
  const report = { categories: 0, types: 0, templates: 0, related: 0, starters: 0 };
  for (const c of newCategories) {
    const r = await db.query(`INSERT INTO ref_categories (id,parent_id,slug,name_ru,sort_order,created_at,demo_tag) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [c.id, c.parent, c.slug, c.name, c.sort, now, tag]);
    report.categories += r.rowCount;
  }
  for (const t of newTypes) {
    const r = await db.query(`INSERT INTO ref_part_types (id,name_ru,category_id,has_side,has_position,sort_order,created_at,demo_tag) VALUES ($1,$2,$3,$4,$5,200,$6,$7) ON CONFLICT DO NOTHING`, [t.id, t.name, t.category, t.hasSide, t.hasPosition, now, tag]);
    report.types += r.rowCount;
  }
  for (const group of templates) {
    const category = group.scope.category ? await categoryId(group.scope.category) : null;
    if (group.scope.category && !category) { console.log(`  ! нет раздела ${group.scope.category} — пропущено`); continue; }
    const type = group.scope.type ?? null;
    if (type && !(await one("SELECT id FROM ref_part_types WHERE id=$1", [type]))) { console.log(`  ! нет типа ${type} — пропущено`); continue; }
    for (const [index, f] of group.fields.entries()) {
      const id = `attr-${(group.scope.category ?? group.scope.type ?? "common").replace(/[^a-z0-9]+/gi, "-")}-${f.key}`;
      const r = await db.query(
        `INSERT INTO ref_attr_templates (id,category_id,part_type_id,key,label_ru,label_ro,kind,unit,options,filterable,in_name,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) ON CONFLICT DO NOTHING`,
        [id, category, type, f.key, f.ru, f.ro, f.kind, f.unit, JSON.stringify(f.options), f.filterable, f.inName, (group.scope.category || group.scope.type ? 100 : 900) + index]);
      report.templates += r.rowCount;
    }
  }
  // Флаг «расходник»: все типы внутри расходных разделов и явно перечисленные.
  for (const slug of consumableCategories) {
    await db.query(`WITH RECURSIVE tree AS (SELECT id FROM ref_categories WHERE slug=$1 UNION ALL SELECT c.id FROM ref_categories c JOIN tree ON c.parent_id=tree.id)
      UPDATE ref_part_types SET consumable=1 WHERE category_id IN (SELECT id FROM tree)`, [slug]);
  }
  await db.query("UPDATE ref_part_types SET consumable=1 WHERE id = ANY($1::text[])", [consumableTypes]);
  for (const [index, [from, to]] of related.entries()) {
    const a = await categoryId(from), b = await categoryId(to);
    if (!a || !b) continue;
    report.related += (await db.query("INSERT INTO ref_related_categories (category_id,related_id,sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [a, b, index])).rowCount;
  }
  const brand = await one("SELECT id FROM ref_brands WHERE lower(name)='mercedes-benz'");
  for (const s of starters) {
    const row = await one("SELECT id, sku, attrs, demo_tag FROM catalog_products WHERE id=$1", [s.id]);
    if (!row || row.sku) continue; // уже переведён
    const category = s.category ? await categoryId(s.category) : null;
    await db.query(
      `UPDATE catalog_products SET sku=$2, oem_number=NULLIF($3,''), part_type_id=$4, category_id=$5, condition='new', brand_id=$6,
         attrs = attrs || $7::jsonb, cross_numbers=$8::jsonb, photos_json=$9, name=COALESCE($10, name), demo_tag=COALESCE(demo_tag,$11),
         return_restricted = GREATEST(return_restricted, (SELECT GREATEST(return_restricted, consumable) FROM ref_part_types WHERE id=$4))
       WHERE id=$1`,
      [s.id, await nextSku(), s.oem, s.type, category, brand?.id ?? null, JSON.stringify(s.attrs ?? {}), JSON.stringify(s.cross ?? []),
        JSON.stringify([{ src: starterImages[s.id], preview: starterImages[s.id], closeup: false }]), s.name ?? null, "p6-starter"]);
    if (s.fitment) await db.query("INSERT INTO part_fitments (product_id,make,model,generation,verified,note) VALUES ($1,$2,$3,$4,false,$5)", [s.id, s.fitment.make, s.fitment.model, s.fitment.generation, s.fitment.note]);
    report.starters++;
  }
  return report;
}

async function clean() {
  await db.query("DELETE FROM part_fitments WHERE product_id IN (SELECT id FROM catalog_products WHERE demo_tag='p6-starter')");
  await db.query("UPDATE catalog_products SET sku=NULL, oem_number=NULL, part_type_id=NULL, category_id=NULL, condition=NULL, brand_id=NULL, attrs='{}', cross_numbers='[]', photos_json='[]', demo_tag=NULL WHERE demo_tag='p6-starter'");
  await db.query("DELETE FROM ref_related_categories");
  await db.query("UPDATE ref_part_types SET consumable=0");
  await db.query("DELETE FROM ref_attr_templates WHERE id LIKE 'attr-%'");
  if ((await one("SELECT 1 FROM catalog_products WHERE part_type_id IN (SELECT id FROM ref_part_types WHERE demo_tag=$1) OR category_id IN (SELECT id FROM ref_categories WHERE demo_tag=$1) LIMIT 1", [tag])))
    throw new Error("В новых разделах уже есть детали — разделы не удалены. Перенесите детали и повторите.");
  await db.query("DELETE FROM ref_part_types WHERE demo_tag=$1", [tag]);
  await db.query("DELETE FROM ref_categories WHERE demo_tag=$1 AND parent_id IS NOT NULL", [tag]);
  await db.query("DELETE FROM ref_categories WHERE demo_tag=$1", [tag]);
}

await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(hashtext('p6-structure'))");
  if (process.argv.includes("--clean")) { await clean(); await db.query("COMMIT"); console.log("Шаблоны и структура П6 убраны."); }
  else {
    const r = await seed(); await db.query("COMMIT");
    console.log(`Добавлено: разделов ${r.categories}, типов ${r.types}, полей шаблона ${r.templates}, связей категорий ${r.related}, стартовых товаров переведено ${r.starters}.`);
  }
} catch (error) {
  await db.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await db.end(); }

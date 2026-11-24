// Структура каталога: подкатегории у каждой основной категории, раздел «Автохимия»
// и типы деталей под новые подкатегории. Скрипт идемпотентен: повторный запуск
// ничего не дублирует и не переписывает уже заведённое владельцем.
//
//   npm run seed:catalog
//
// Товары здесь не создаются: цены, артикулы и размеры заводит владелец.
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

// Подкатегории привязываются к родителю по его адресу: id у владельца могут быть свои.
// Четвёртое поле строки — отметка «не возвращается» на типе детали.
const groups = [
  { parent: "demo-brakes", children: [
    ["Тормозные диски", "tormoznye-diski", "Тормозной диск"],
    ["Суппорты и скобы", "supporty-i-skoby", "Суппорт"],
    ["Тормозные барабаны", "tormoznye-barabany", "Тормозной барабан"],
    ["Главный тормозной цилиндр", "glavnyy-tormoznoy-cilindr", "Главный тормозной цилиндр"],
    ["Шланги и трубки", "tormoznye-shlangi", "Тормозной шланг"],
    ["Датчики ABS", "datchiki-abs", "Датчик ABS"],
  ] },
  { parent: "demo-engine", children: [
    ["Головка блока цилиндров", "golovka-bloka-cilindrov", "Головка блока цилиндров"],
    ["Поршни и шатуны", "porshni-i-shatuny", "Поршень"],
    ["Коленвал и распредвал", "kolenval-i-raspredval", "Коленвал"],
    ["Ремни и цепи ГРМ", "remni-i-cepi-grm", "Ремень ГРМ"],
    ["Турбины", "turbiny", "Турбина"],
    ["Топливная аппаратура", "toplivnaya-apparatura", "Топливный насос"],
    ["Охлаждение двигателя", "ohlazhdenie-dvigatelya", "Радиатор охлаждения"],
    ["Прокладки и сальники", "prokladki-i-salniki", "Прокладка ГБЦ"],
  ] },
  { parent: "demo-body", children: [
    ["Двери", "dveri", null],
    ["Капот и крылья", "kapot-i-krylya", "Капот"],
    ["Бамперы", "bampery", "Бампер"],
    ["Зеркала", "zerkala", null],
    ["Стёкла", "stekla", "Стекло"],
    ["Решётки радиатора", "reshetki-radiatora", "Решётка радиатора"],
    ["Крышка багажника", "kryshka-bagazhnika", "Крышка багажника"],
    ["Пороги и арки", "porogi-i-arki", "Порог"],
  ] },
  { parent: "demo-optics", children: [
    ["Фары", "fary", null],
    ["Задние фонари", "zadnie-fonari", null],
    ["Противотуманные фары", "protivotumannye-fary", "Противотуманная фара"],
    ["Повторители поворота", "povtoriteli-povorota", "Повторитель поворота"],
    ["Лампы и ксенон", "lampy-i-ksenon", "Лампа"],
    ["Блоки розжига", "bloki-rozzhiga", "Блок розжига"],
  ] },
  { parent: "demo-filters", children: [
    ["Масляные фильтры", "maslyanye-filtry", "Масляный фильтр"],
    ["Воздушные фильтры", "vozdushnye-filtry", "Воздушный фильтр"],
    ["Салонные фильтры", "salonnye-filtry", "Салонный фильтр"],
    ["Топливные фильтры", "toplivnye-filtry", "Топливный фильтр"],
  ] },
  { parent: "demo-oils", children: [
    ["Моторные масла", "motornye-masla", "Моторное масло", true],
    ["Трансмиссионные масла", "transmissionnye-masla", "Трансмиссионное масло", true],
    ["Гидравлические жидкости", "gidravlicheskie-zhidkosti", "Гидравлическая жидкость", true],
    ["Смазки", "smazki", "Смазка", true],
  ] },
  { parent: "elektrika", children: [
    ["Стартеры", "startery", null],
    ["Генераторы", "generatory", null],
    ["Аккумуляторы", "akkumulyatory", "Аккумулятор"],
    ["Катушки зажигания", "katushki-zazhiganiya", null],
    ["Датчики", "datchiki", "Датчик"],
    ["Блоки управления", "bloki-upravleniya", "Блок управления"],
    ["Проводка и реле", "provodka-i-rele", "Жгут проводки"],
  ] },
];

// «Автохимия» — новый основной раздел. Адрес совпадает с направлением /catalog/avtohimiya.
const avtohimiya = {
  slug: "avtohimiya",
  nameRu: "Автохимия",
  nameRo: "Autochimie",
  intro: "Жидкости, очистители и средства ухода за автомобилем. Новые расходники возврату не подлежат.",
  children: [
    ["Антифризы и охлаждающие жидкости", "antifrizy", "Антифриз"],
    ["Тормозные жидкости", "tormoznye-zhidkosti", "Тормозная жидкость"],
    ["Стеклоомыватели", "stekloomyvateli", "Стеклоомывающая жидкость"],
    ["Очистители и обезжириватели", "ochistiteli", "Очиститель"],
    ["Автошампуни и мойка", "avtoshampuni", "Автошампунь"],
    ["Полироли и воски", "poliroli-i-voski", "Полироль"],
    ["Присадки", "prisadki", "Присадка"],
    ["Уход за салоном", "uhod-za-salonom", "Средство для салона"],
    ["Герметики и клеи", "germetiki-i-klei", "Герметик"],
  ],
};

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

const added = { categories: [], types: [], skipped: [] };
const nowIso = () => new Date().toISOString();

async function categoryIdBySlug(slug) {
  const { rows } = await client.query("SELECT id FROM ref_categories WHERE slug = $1", [slug]);
  return rows[0]?.id ?? null;
}

async function ensureCategory({ id, parentId, slug, nameRu, nameRo = "", intro = "" }) {
  const existing = await categoryIdBySlug(slug);
  if (existing) { added.skipped.push(`категория /${slug}`); return existing; }
  const { rows } = await client.query(
    "SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_categories WHERE parent_id IS NOT DISTINCT FROM $1", [parentId]);
  await client.query(
    `INSERT INTO ref_categories (id,parent_id,slug,name_ru,name_ro,image,intro,seo_title,seo_description,visible,sort_order,created_at)
     VALUES ($1,$2,$3,$4,$5,'',$6,'','',1,$7,$8) ON CONFLICT (id) DO NOTHING`,
    [id, parentId, slug, nameRu, nameRo, intro, Number(rows[0].next), nowIso()]);
  added.categories.push(`${nameRu} (/${slug})`);
  return id;
}

async function ensureType({ id, nameRu, categoryId, returnRestricted = false }) {
  const { rows } = await client.query("SELECT id FROM ref_part_types WHERE lower(name_ru) = lower($1)", [nameRu]);
  if (rows[0]) { added.skipped.push(`тип «${nameRu}»`); return rows[0].id; }
  const next = await client.query("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_part_types");
  await client.query(
    `INSERT INTO ref_part_types (id,name_ru,name_ro,category_id,has_side,has_position,assembly,assembly_includes,return_restricted,sort_order,created_at)
     VALUES ($1,$2,'',$3,0,0,0,'',$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [id, nameRu, categoryId, returnRestricted ? 1 : 0, Number(next.rows[0].next), nowIso()]);
  added.types.push(nameRu);
  return id;
}

try {
  await client.query("BEGIN");

  for (const group of groups) {
    const parentId = await categoryIdBySlug(group.parent);
    if (!parentId) { added.skipped.push(`родитель /${group.parent} не найден`); continue; }
    for (const [nameRu, slug, typeName, restricted] of group.children) {
      const categoryId = await ensureCategory({ id: `cat-${slug}`, parentId, slug, nameRu });
      if (typeName) await ensureType({ id: `type-${slug}`, nameRu: typeName, categoryId, returnRestricted: Boolean(restricted) });
    }
  }

  const rootId = await ensureCategory({
    id: `cat-${avtohimiya.slug}`, parentId: null, slug: avtohimiya.slug,
    nameRu: avtohimiya.nameRu, nameRo: avtohimiya.nameRo, intro: avtohimiya.intro,
  });
  for (const [nameRu, slug, typeName] of avtohimiya.children) {
    const categoryId = await ensureCategory({ id: `cat-${slug}`, parentId: rootId, slug, nameRu });
    // Новые расходники владелец возвращать не берётся — отметка стоит на типе детали.
    if (typeName) await ensureType({ id: `type-${slug}`, nameRu: typeName, categoryId, returnRestricted: true });
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

console.log(`Добавлено категорий: ${added.categories.length}`);
for (const line of added.categories) console.log("  + " + line);
console.log(`Добавлено типов деталей: ${added.types.length}`);
for (const line of added.types) console.log("  + " + line);
console.log(`Пропущено (уже есть): ${added.skipped.length}`);

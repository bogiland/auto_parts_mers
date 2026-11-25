// Дополнительный демонабор: Lexus и Tesla с деталями по всем разделам каталога.
//
//   npm run seed:demo-more            — добавить (повторный запуск ничего не дублирует)
//   npm run seed:demo-more -- --clean — убрать только эти записи
//
// Всё помечено demo_tag = 'naa-demo-v2'. Каталожные номера (OEM) не заполняются:
// проверенных номеров для этих машин нет, а выдуманный номер хуже пустого поля —
// покупатель закажет по нему не ту деталь. Пробег и мотор доноров тоже пустые.
// Цены демонстрационные, как и в основном демонаборе.
import "./env.mjs";
import pg from "pg";

const tag = "naa-demo-v2";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const now = new Date().toISOString();
const photo = (file) => ({ src: `/demo/${file}`, preview: `/demo/${file}`, closeup: false });

/** Машины: марка, модель, кузов, годы выпуска кузова. Год донора не указан — его вносит владелец. */
const cars = [
  { key: "lexus-rx-al10", make: "Lexus", model: "RX", generation: "AL10", from: 2009, to: 2015 },
  { key: "lexus-is-xe30", make: "Lexus", model: "IS", generation: "XE30", from: 2013, to: 2020 },
  { key: "tesla-model3", make: "Tesla", model: "Model 3", generation: "Model 3", from: 2017, to: null },
  { key: "tesla-models", make: "Tesla", model: "Model S", generation: "Model S", from: 2012, to: null },
];

/**
 * Детали: подкатегория (адрес раздела), тип детали (по названию в справочнике), сторона, положение.
 * У Tesla нет ДВС: ей не ставятся ГБЦ, турбины, топливная аппаратура, свечи и масляные фильтры.
 */
const common = [
  ["tormoznye-diski", "Тормозной диск", "", "front"],
  ["supporty-i-skoby", "Суппорт", "left", "front"],
  ["datchiki-abs", "Датчик ABS", "right", "front"],
  ["tormoznye-shlangi", "Тормозной шланг", "", "rear"],
  ["dveri", "Дверь", "left", ""],
  ["dveri", "Дверь", "right", ""],
  ["kapot-i-krylya", "Капот", "", ""],
  ["bampery", "Бампер", "", "front"],
  ["zerkala", "Зеркало", "left", ""],
  ["kryshka-bagazhnika", "Крышка багажника", "", ""],
  ["fary", "Фара", "left", ""],
  ["fary", "Фара", "right", ""],
  ["zadnie-fonari", "Фонарь", "right", "rear"],
  ["povtoriteli-povorota", "Повторитель поворота", "left", ""],
  ["salonnye-filtry", "Салонный фильтр", "", ""],
  ["datchiki", "Датчик", "", ""],
  ["bloki-upravleniya", "Блок управления", "", ""],
  ["provodka-i-rele", "Жгут проводки", "", ""],
  ["akkumulyatory", "Аккумулятор", "", ""],
];
const combustion = [
  ["golovka-bloka-cilindrov", "Головка блока цилиндров", "", ""],
  ["remni-i-cepi-grm", "Ремень ГРМ", "", ""],
  ["toplivnaya-apparatura", "Топливный насос", "", ""],
  ["ohlazhdenie-dvigatelya", "Радиатор охлаждения", "", ""],
  ["startery", "Стартер", "", ""],
  ["generatory", "Генератор", "", ""],
  ["katushki-zazhiganiya", "Катушка зажигания", "", ""],
  ["maslyanye-filtry", "Масляный фильтр", "", ""],
  ["vozdushnye-filtry", "Воздушный фильтр", "", ""],
  ["protivotumannye-fary", "Противотуманная фара", "right", "front"],
];
const electric = [
  ["ohlazhdenie-dvigatelya", "Радиатор охлаждения", "", ""],
  ["bloki-rozzhiga", "Блок розжига", "", ""],
  ["stekla", "Стекло", "", "front"],
];

const sideRu = { left: " левая", right: " правая", "": "" };
const sideRo = { left: " stânga", right: " dreapta", "": "" };
const positionRu = { front: " передн.", rear: " задн.", "": "" };

async function one(sql, values = []) { return (await db.query(sql, values)).rows[0] ?? null; }

async function clean() {
  const used = await one(
    "SELECT 1 FROM order_items i JOIN catalog_products p ON p.id = i.product_id WHERE p.demo_tag = $1 LIMIT 1", [tag]);
  if (used) throw new Error("Очистка отменена: детали из набора уже есть в заказах. Снимите их с витрины вручную.");
  await db.query("DELETE FROM part_offers WHERE product_id IN (SELECT id FROM catalog_products WHERE demo_tag = $1)", [tag]);
  await db.query("DELETE FROM stock_moves WHERE product_id IN (SELECT id FROM catalog_products WHERE demo_tag = $1)", [tag]);
  for (const table of ["catalog_products", "donors", "ref_generations", "ref_models", "ref_makes"]) {
    await db.query(`DELETE FROM ${table} WHERE demo_tag = $1`, [tag]);
  }
}

async function seed() {
  const report = { makes: 0, donors: 0, parts: 0, skipped: [] };
  let sku = Number((await one("SELECT COALESCE(MAX(NULLIF(regexp_replace(sku,'\\D','','g'),'')::int),0) AS n FROM catalog_products WHERE sku LIKE 'DEMO2-%'"))?.n ?? 0);

  for (const [index, car] of cars.entries()) {
    // Марка: если владелец уже завёл её в справочнике — используем его запись.
    let make = await one("SELECT id FROM ref_makes WHERE lower(name) = lower($1)", [car.make]);
    if (!make) {
      make = { id: `demo2-make-${car.make.toLowerCase()}` };
      await db.query("INSERT INTO ref_makes (id,name,logo,sort_order,created_at,demo_tag) VALUES ($1,$2,'',$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [make.id, car.make, 100 + index, now, tag]);
      report.makes++;
    }
    let model = await one("SELECT id FROM ref_models WHERE make_id = $1 AND lower(name) = lower($2)", [make.id, car.model]);
    if (!model) {
      model = { id: `demo2-model-${car.key}` };
      await db.query("INSERT INTO ref_models (id,make_id,name,sort_order,created_at,demo_tag) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [model.id, make.id, car.model, index + 1, now, tag]);
    }
    let generation = await one("SELECT id FROM ref_generations WHERE model_id = $1 AND lower(name) = lower($2)", [model.id, car.generation]);
    if (!generation) {
      generation = { id: `demo2-generation-${car.key}` };
      await db.query("INSERT INTO ref_generations (id,model_id,name,year_from,year_to,engines,sort_order,created_at,demo_tag) VALUES ($1,$2,$3,$4,$5,'',$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [generation.id, model.id, car.generation, car.from, car.to, index + 1, now, tag]);
    }

    const donorId = `demo2-donor-${car.key}`;
    if (!(await one("SELECT id FROM donors WHERE id = $1", [donorId]))) {
      await db.query(
        `INSERT INTO donors (id,make_id,model_id,generation_id,make,model,generation,year,engine,mileage,note,photos_json,visible,created_at,demo_tag)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'',NULL,$8,$9,1,$10,$11)`,
        [donorId, make.id, model.id, generation.id, car.make, car.model, car.generation,
          "Демодонор для проверки витрины. Год, мотор и пробег вносит владелец.", JSON.stringify([photo("donor.svg")]), now, tag]);
      report.donors++;
    }

    const isElectric = car.make === "Tesla";
    const list = [...common, ...(isElectric ? electric : combustion)];
    for (const [partIndex, [categorySlug, typeName, side, position]] of list.entries()) {
      const partId = `demo2-part-${car.key}-${partIndex}`;
      if (await one("SELECT id FROM catalog_products WHERE id = $1", [partId])) continue;
      const category = await one("SELECT id FROM ref_categories WHERE slug = $1", [categorySlug]);
      const type = await one("SELECT id, name_ro, return_restricted FROM ref_part_types WHERE lower(name_ru) = lower($1)", [typeName]);
      if (!category) { report.skipped.push(`нет раздела /${categorySlug} — запустите npm run seed:catalog`); continue; }

      const title = `${car.make} ${car.model}${car.generation !== car.model ? ` ${car.generation}` : ""}`;
      const nameRu = `${typeName}${sideRu[side]}${positionRu[position]} ${title}`.replace(/\s+/g, " ").trim();
      const nameRo = type?.name_ro ? `${type.name_ro}${sideRo[side]} ${title}` : "";
      sku += 1;
      // Цена демонстрационная: у каждой третьей детали — «по запросу», как бывает на разборке.
      const price = (partIndex + index) % 3 === 2 ? null : 400 + ((partIndex * 37 + index * 113) % 40) * 50;
      const image = ["wide.svg", "square.svg", "portrait.svg"][partIndex % 3];
      await db.query(
        `INSERT INTO catalog_products
          (id,name,name_ro,slug,sku,oem_number,price_mdl,price_mode,stock,condition,donor_id,part_type_id,category_id,model_id,
           location,side,position,applicability,return_restricted,photos_json,hidden,created_at,demo_tag)
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,1,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,0,$19,$20)`,
        [partId, nameRu, nameRo, `demo2-${car.key}-${partIndex + 1}`, `DEMO2-${String(sku).padStart(4, "0")}`,
          price, price === null ? "on_request" : "fixed", ["good", "good", "defect"][partIndex % 3], donorId,
          type?.id ?? null, category.id, model.id, `L-${index + 1}`, side, position, title,
          Number(type?.return_restricted ?? 0), JSON.stringify([photo(image)]), now, tag]);
      await db.query(
        "INSERT INTO part_offers (id,product_id,supplier,supplier_name,price_mdl,stock,lead_days,created_at) VALUES ($1,$2,'own','Свой склад',$3,1,0,$4) ON CONFLICT DO NOTHING",
        [`demo2-offer-${car.key}-${partIndex}`, partId, price, now]);
      report.parts++;
    }
  }
  return report;
}

await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(hashtext('naa-demo-v2'))");
  if (process.argv.includes("--clean")) {
    await clean();
    await db.query("COMMIT");
    console.log("Набор naa-demo-v2 удалён.");
  } else {
    const report = await seed();
    await db.query("COMMIT");
    console.log(`Добавлено: марок ${report.makes}, доноров ${report.donors}, деталей ${report.parts}.`);
    for (const line of new Set(report.skipped)) console.log("  ! " + line);
    console.log("Каталожные номера не заполнены: проверенных номеров нет. Цены демонстрационные.");
  }
} catch (error) {
  await db.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.end();
}

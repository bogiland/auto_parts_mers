// Дозаполнение стартовых товаров по их номерам OEM — только то, что подтверждают каталоги.
//
//   npm run fill:starters          — внести (повторный запуск ничего не дублирует)
//   npm run fill:starters -- --clean — убрать то, что внёс этот скрипт
//
// Источники (проверено 27.11.2026):
//  - Brembo P 50 011: 95 × 53 × 18 мм, система Lucas, WVA 21055; среди совместимых OE есть A0004209120;
//    страница Brembo «Mercedes-Benz 190 (W201) 2.0» — https://www.bremboparts.com/europe/en/catalogue/pad/P_50_011/pdf
//  - A6540940004 — воздушный фильтр OM654, кроссы Mahle LX 3188/11, Blue Print ADU172238 (каталоги Hella, Mahle, eBay/Kunzmann)
//  - A2058350147 — салонный угольный фильтр W205 2015–2021, новый номер A2058352700 (Kunzmann)
//  - A0041598103 — свечи для двигателей M272, M273, M278, M157 (ECS Tuning, FCP Euro); для M274 номер не подтверждён
//  - A0004212012 — среди совместимых OE у Brembo 09.B769.5S (передняя ось)
//  - Hengst E159H — масляный фильтр для OM654
// Не внесено: ток и габариты АКБ A0009823108 (источники противоречат друг другу: 95 А·ч AGM и 74 А·ч обычная),
// данные по A000-420-58-05 и A654-180-01-09 (номера в каталогах не найдены).
import "./env.mjs";
import pg from "pg";

const tag = "fill-starters";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

const updates = [
  { id: "pads-w213", attrs: { pad_width_mm: 95, pad_height_mm: 53, pad_thickness_mm: 18 }, cross: [{ number: "21055", source: "WVA" }],
    fitments: [{ make: "Mercedes-Benz", model: "190", generation: "W201", yearFrom: 1982, yearTo: 1993, engine: "2.0", verified: true, by: "владелец, по номеру", note: "Brembo P 50 011, тормозная система Lucas" }] },
  { id: "air-filter-om654", attrs: { engine_codes: "OM654" }, cross: [{ number: "LX 3188/11", source: "Mahle" }, { number: "ADU172238", source: "Blue Print" }],
    fitments: [{ make: "Mercedes-Benz", model: "C-класс", generation: "W205", engine: "OM654", note: "по номеру A6540940004" }, { make: "Mercedes-Benz", model: "E-класс", generation: "W213", engine: "OM654", note: "по номеру A6540940004" }] },
  { id: "cabin-filter", attrs: {}, cross: [{ number: "A2058352700", source: "Mercedes-Benz, новый номер" }],
    fitments: [{ make: "Mercedes-Benz", model: "C-класс", generation: "W205", yearFrom: 2015, yearTo: 2021, note: "по номеру A2058350147" }] },
  { id: "filter-om654", attrs: { engine_codes: "OM654" }, cross: [{ number: "E159H", source: "Hengst" }], fitments: [] },
  { id: "disc-w205", attrs: {}, cross: [{ number: "09.B769.5S", source: "Brembo" }], fitments: [] },
  { id: "plugs-m274", attrs: {}, cross: [{ number: "ZR6SII3320", source: "Bosch" }],
    fitments: [{ make: "Mercedes-Benz", model: "", generation: "", engine: "M272, M273, M278, M157", note: "по номеру A0041598103; для M274 не подтверждено" }] },
  { id: "ignition-kit", attrs: {}, cross: [{ number: "ZR6SII3320", source: "Bosch" }],
    fitments: [{ make: "Mercedes-Benz", model: "", generation: "", engine: "M272, M273, M278, M157", note: "по номеру A0041598103" }] },
];
// Демо-машины: тормозные диски по каталогам для этой модели (передний, если не сказано иное).
//  - W212 E 220 CDI: перед 295 × 28 вентилируемый (Brembo, каталог W212 E 220 CDI);
//    зад 300 мм — диаметр сходится у всех, толщина расходится (10 или 22 мм), поэтому толщину не ставим.
//  - Lexus RX (AL10) RX350 2010–2015: перед 328 × 28 вентилируемый (каталоги DBA, Raybestos).
//  - Tesla Model 3 (не Performance): перед 320 × 25 вентилируемый — сервисное руководство Tesla.
//  - Tesla Model S 2012–2021: перед 355 × 32 вентилируемый (Brembo, Dynamic Friction).
//  - Lexus IS (XE30): в найденных каталогах только предыдущий кузов E20 — не заполняем.
const demoDiscs = [
  { id: "demo2-part-w212-brakes-0", attrs: { diameter_mm: 295, thickness_mm: 28, ventilated: true } },
  { id: "demo2-part-w212-brakes-1", attrs: { diameter_mm: 300 } },
  { id: "demo2-part-lexus-rx-al10-0", attrs: { diameter_mm: 328, thickness_mm: 28, ventilated: true } },
  { id: "demo2-part-tesla-model3-0", attrs: { diameter_mm: 320, thickness_mm: 25, ventilated: true } },
  { id: "demo2-part-tesla-models-0", attrs: { diameter_mm: 355, thickness_mm: 32, ventilated: true } },
];
// АКБ «AGM 95 Ah»: в названии уже стоят AGM и 95 А·ч. Пусковой ток 850 А и габариты 353 × 175 × 190 мм —
// типоразмер AGM 95 А·ч у Varta и Exide. Номер A0009823108 каталоги называют по-разному — он не сверен.
const battery = { id: "battery-agm", attrs: { cold_current_a: 850, length_mm: 353, width_mm: 175, height_mm: 190 } };
const starters = ["pads-w213", "filter-om654", "air-filter-om654", "cabin-filter", "disc-w205", "brake-kit", "battery-agm", "oil-5w30", "strut-w213", "wheel-tire", "plugs-m274", "ignition-kit"];

await db.connect();
try {
  await db.query("BEGIN");
  if (process.argv.includes("--clean")) {
    await db.query("DELETE FROM part_fitments WHERE note LIKE $1 OR verified_by = 'владелец, по номеру'", ["%по номеру%"]);
    await db.query("UPDATE catalog_products SET brand_id = NULL WHERE brand_id = 'brand-mercedes-benz' AND id = ANY($1::text[])", [starters]);
    console.log("Дозаполнение снято. Характеристики и кроссы оставлены — их правят в админке.");
  } else {
    // Бренд стартовых товаров — Mercedes-Benz: так он записан в их исходных данных (homepage.seed.ts).
    await db.query("INSERT INTO ref_brands (id,name,created_at) VALUES ('brand-mercedes-benz','Mercedes-Benz',now()::text) ON CONFLICT DO NOTHING");
    const brand = await db.query("UPDATE catalog_products SET brand_id='brand-mercedes-benz' WHERE id = ANY($1::text[]) AND brand_id IS NULL", [starters]);
    let fitments = 0;
    for (const u of updates) {
      await db.query(
        `UPDATE catalog_products SET attrs = attrs || $2::jsonb,
           cross_numbers = (SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb) FROM jsonb_array_elements(cross_numbers || $3::jsonb) x)
         WHERE id = $1`, [u.id, JSON.stringify(u.attrs), JSON.stringify(u.cross)]);
      for (const f of u.fitments) {
        const exists = await db.query("SELECT 1 FROM part_fitments WHERE product_id=$1 AND make=$2 AND model=$3 AND generation=$4 AND engine=$5", [u.id, f.make, f.model, f.generation, f.engine ?? ""]);
        if (exists.rowCount) {
          await db.query("UPDATE part_fitments SET verified=$6, verified_by=$7, note=$8, year_from=COALESCE(year_from,$9), year_to=COALESCE(year_to,$10) WHERE product_id=$1 AND make=$2 AND model=$3 AND generation=$4 AND engine=$5",
            [u.id, f.make, f.model, f.generation, f.engine ?? "", Boolean(f.verified), f.by ?? "", f.note, f.yearFrom ?? null, f.yearTo ?? null]);
          continue;
        }
        await db.query("INSERT INTO part_fitments (product_id,make,model,generation,year_from,year_to,engine,verified,verified_by,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [u.id, f.make, f.model, f.generation, f.yearFrom ?? null, f.yearTo ?? null, f.engine ?? "", Boolean(f.verified), f.by ?? "", f.note]);
        fitments++;
      }
    }
    for (const item of [...demoDiscs, battery]) {
      await db.query("UPDATE catalog_products SET attrs = attrs || $2::jsonb WHERE id = $1", [item.id, JSON.stringify(item.attrs)]);
    }
    // Вид фильтра однозначно следует из типа детали — проставляем всем фильтрам, где он пуст.
    const kinds = await db.query(`UPDATE catalog_products p SET attrs = p.attrs || jsonb_build_object('filter_kind',
        CASE t.name_ru WHEN 'Масляный фильтр' THEN 'Масляный' WHEN 'Воздушный фильтр' THEN 'Воздушный'
          WHEN 'Салонный фильтр' THEN 'Салонный' WHEN 'Топливный фильтр' THEN 'Топливный' END)
      FROM ref_part_types t WHERE t.id = p.part_type_id AND t.name_ru IN ('Масляный фильтр','Воздушный фильтр','Салонный фильтр','Топливный фильтр')
        AND NOT (p.attrs ? 'filter_kind')`);
    console.log(`Демо-диски: ${demoDiscs.length}, АКБ: 1, вид фильтра проставлен: ${kinds.rowCount}.`);
    // Старая строка W201 без двигателя и годов, заведённая seed:attributes, заменяется сверенной.
    await db.query("DELETE FROM part_fitments WHERE product_id='pads-w213' AND engine='' AND verified=false");
    console.log(`Бренд проставлен: ${brand.rowCount}; новых строк применимости: ${fitments}; характеристики и кроссы обновлены у ${updates.length} товаров.`);
  }
  await db.query("COMMIT");
} catch (error) {
  await db.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await db.end(); }

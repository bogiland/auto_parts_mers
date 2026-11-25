import "server-only";

import { many } from "@/lib/db";
import { ensureSeeded } from "@/lib/checkout-db";

/**
 * Единый справочник машин для витрины.
 *
 * Он строится от доноров и деталей в базе, а не от модельного ряда новых машин.
 * Раньше марки жили в трёх местах: подбор на главной знал три марки, каталог —
 * восемнадцать из `data/vehicles/brands.json`, меню — своё. В итоге у E-класса
 * в одном месте был W212, в другом W213, а четырнадцать марок вели на пустые
 * страницы: деталей для них никогда не было.
 *
 * Марка попадает сюда, только если у неё есть хотя бы одна видимая деталь.
 * Поэтому Lexus появится сам, как только заведут первого донора Lexus с деталью,
 * а Audi и Kia исчезнут, пока деталей нет.
 */

export type ShowroomGeneration = { slug: string; name: string; donorIds: string[]; parts: number; inStock: number };
export type ShowroomModel = { slug: string; name: string; generations: ShowroomGeneration[]; parts: number; inStock: number };
export type ShowroomMake = { slug: string; name: string; models: ShowroomModel[]; parts: number; inStock: number };

/** Адрес из названия: кириллица переводится, всё лишнее превращается в дефис. */
const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function vehicleSlug(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .split("")
    .map((letter) => translit[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Row = {
  make: string; model: string; generation: string; donor_id: string;
  parts: string; in_stock: string;
};

/**
 * Марки, модели и поколения, у которых есть детали.
 * Скрытые детали не считаются: раздел, где всё скрыто, на витрине не нужен.
 */
export async function showroomVehicles(): Promise<ShowroomMake[]> {
  await ensureSeeded();
  const rows = (await many<Row>(`
    SELECT d.make, d.model, d.generation, d.id AS donor_id,
           COUNT(p.id) AS parts,
           COUNT(p.id) FILTER (WHERE p.stock > 0) AS in_stock
    FROM donors d
    JOIN catalog_products p ON p.donor_id = d.id AND p.hidden = 0
    WHERE d.visible = 1
    GROUP BY d.id, d.make, d.model, d.generation
    HAVING COUNT(p.id) > 0
    ORDER BY d.make, d.model, d.generation`));

  const makes = new Map<string, ShowroomMake>();
  for (const row of rows) {
    const makeName = String(row.make).trim();
    if (!makeName) continue;
    const makeSlug = vehicleSlug(makeName);
    let make = makes.get(makeSlug);
    if (!make) { make = { slug: makeSlug, name: makeName, models: [], parts: 0, inStock: 0 }; makes.set(makeSlug, make); }

    const modelName = String(row.model).trim() || "Без модели";
    const modelSlug = vehicleSlug(modelName);
    let model = make.models.find((item) => item.slug === modelSlug);
    if (!model) { model = { slug: modelSlug, name: modelName, generations: [], parts: 0, inStock: 0 }; make.models.push(model); }

    const parts = Number(row.parts);
    const inStock = Number(row.in_stock);
    const generationName = String(row.generation).trim();
    if (generationName) {
      const generationSlug = vehicleSlug(generationName);
      let generation = model.generations.find((item) => item.slug === generationSlug);
      if (!generation) { generation = { slug: generationSlug, name: generationName, donorIds: [], parts: 0, inStock: 0 }; model.generations.push(generation); }
      generation.donorIds.push(String(row.donor_id));
      generation.parts += parts;
      generation.inStock += inStock;
    }
    model.parts += parts;
    model.inStock += inStock;
    make.parts += parts;
    make.inStock += inStock;
  }

  return [...makes.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

/** Одна марка по адресу. Нет деталей — нет и страницы: отдаём null, страница ответит 404. */
export async function showroomMake(slug: string): Promise<ShowroomMake | null> {
  return (await showroomVehicles()).find((make) => make.slug === slug) ?? null;
}

/** Идентификаторы доноров выбранной машины: по ним собирается список деталей. */
export function donorsOf(make: ShowroomMake, modelSlug?: string, generationSlug?: string): string[] {
  const models = modelSlug ? make.models.filter((model) => model.slug === modelSlug) : make.models;
  return models.flatMap((model) => {
    const generations = generationSlug ? model.generations.filter((item) => item.slug === generationSlug) : model.generations;
    return generations.flatMap((generation) => generation.donorIds);
  });
}

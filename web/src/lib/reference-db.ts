import "server-only";

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureSeeded } from "@/lib/checkout-db";
import { audit, type Staff } from "@/lib/staff-db";
import { inTx, many, one, run, tx } from "@/lib/db";

type Row = Record<string, unknown>;

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString("hex")}`;
const MAX_DEPTH = 3;

function text(value: unknown, limit: number, field: string, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && result.length < 2) throw new Error(`Заполните поле «${field}».`);
  if (result.length > limit) throw new Error(`Поле «${field}» длиннее ${limit} символов.`);
  return result;
}
const flag = (value: unknown) => (value === true || value === 1 || value === "on" || value === "1" ? 1 : 0);

export function slugify(value: string) {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ă: "a", â: "a", î: "i", ș: "s", ț: "t" };
  return value.toLowerCase().split("").map((letter) => map[letter] ?? letter).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/* ---------- Категории ---------- */

export type CategoryNode = { id: string; parentId: string | null; slug: string; nameRu: string; nameRo: string; image: string; intro: string; seoTitle: string; seoDescription: string; visible: boolean; depth: number; parts: number; inStock: number; children: CategoryNode[] };

async function partCounts() {
  const counts = new Map<string, { parts: number; inStock: number }>();
  const rows = await many("SELECT category_id, COUNT(*) AS parts, SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS in_stock FROM catalog_products WHERE category_id IS NOT NULL GROUP BY category_id");
  for (const row of rows) counts.set(String(row.category_id), { parts: Number(row.parts), inStock: Number(row.in_stock ?? 0) });
  return counts;
}

export async function categoryTree(): Promise<CategoryNode[]> {
  await ensureSeeded();
  const rows = await many("SELECT * FROM ref_categories ORDER BY sort_order, name_ru");
  const counts = await partCounts();
  const build = (parentId: string | null, depth: number): CategoryNode[] =>
    rows.filter((row) => ((row.parent_id as string | null) ?? null) === parentId).map((row) => {
      const id = String(row.id);
      const children = build(id, depth + 1);
      const own = counts.get(id) ?? { parts: 0, inStock: 0 };
      return {
        id, parentId, slug: String(row.slug), nameRu: String(row.name_ru), nameRo: String(row.name_ro),
        image: String(row.image), intro: String(row.intro), seoTitle: String(row.seo_title),
        seoDescription: String(row.seo_description), visible: Number(row.visible) === 1, depth,
        parts: own.parts + children.reduce((sum, child) => sum + child.parts, 0),
        inStock: own.inStock + children.reduce((sum, child) => sum + child.inStock, 0),
        children,
      };
    });
  return build(null, 1);
}

export async function flatCategories() {
  const flatten = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((node) => [node, ...flatten(node.children)]);
  return flatten(await categoryTree());
}

async function depthOf(id: string | null): Promise<number> {
  let depth = 0;
  let current = id;
  while (current) {
    depth += 1;
    if (depth > MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
    const row = await one("SELECT parent_id FROM ref_categories WHERE id = $1", [current]);
    current = (row?.parent_id as string | null) ?? null;
  }
  return depth;
}

async function subtreeHeight(id: string): Promise<number> {
  const children = await many("SELECT id FROM ref_categories WHERE parent_id = $1", [id]);
  if (!children.length) return 1;
  const heights = await Promise.all(children.map(async (child) => (await subtreeHeight(String(child.id)))));
  return 1 + Math.max(...heights);
}

export async function saveCategory(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const nameRu = text(input.nameRu, 120, "Название RU", true);
  const nameRo = text(input.nameRo, 120, "Название RO");
  const intro = text(input.intro, 600, "Текст для страницы");
  const seoTitle = text(input.seoTitle, 160, "Заголовок для поиска");
  const seoDescription = text(input.seoDescription, 320, "Описание для поиска");
  const image = typeof input.image === "string" ? saveImage(input.image) : "";
  // Галочки нет в запросе — значит её никто не снимал: новая категория показывается на сайте сразу.
  const visible = input.visible === undefined ? 1 : flag(input.visible);
  const parentId = typeof input.parentId === "string" && input.parentId ? input.parentId : null;
  if (parentId && !(await one("SELECT id FROM ref_categories WHERE id = $1", [parentId]))) throw new Error("Родительская категория не найдена.");
  if (parentId && parentId === id) throw new Error("Категория не может быть вложена в себя.");
  const slug = slugify(typeof input.slug === "string" && input.slug.trim() ? input.slug : nameRu);
  if (slug.length < 2) throw new Error("Адрес страницы должен содержать хотя бы две латинские буквы.");
  if (await one("SELECT id FROM ref_categories WHERE slug = $1 AND id <> $2", [slug, id ?? ""])) throw new Error(`Адрес «${slug}» уже занят другой категорией.`);

  if (!id) {
    const parentDepth = parentId ? await depthOf(parentId) : 0;
    if (parentDepth >= MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
    const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_categories WHERE parent_id IS NOT DISTINCT FROM $1", [parentId]);
    const created = newId("cat");
    await run(
      `INSERT INTO ref_categories (id,parent_id,slug,name_ru,name_ro,image,intro,seo_title,seo_description,visible,sort_order,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [created, parentId, slug, nameRu, nameRo, image, intro, seoTitle, seoDescription, visible, Number(next?.next ?? 1), now()],
    );
    await audit(actor, "Категория создана", `${created}: ${nameRu} (/${slug})`);
    return created;
  }

  const before = await one("SELECT slug, name_ru, image FROM ref_categories WHERE id = $1", [id]);
  if (!before) throw new Error("Категория не найдена.");
  const keepImage = image || String(before.image ?? "");
  await run(
    `UPDATE ref_categories SET parent_id=$1, slug=$2, name_ru=$3, name_ro=$4, image=$5, intro=$6,
       seo_title=$7, seo_description=$8, visible=$9 WHERE id=$10`,
    [parentId, slug, nameRu, nameRo, keepImage, intro, seoTitle, seoDescription, visible, id],
  );
  if (String(before.slug) !== slug) {
    await run("INSERT INTO ref_category_redirects (old_slug, category_id, at) VALUES ($1,$2,$3) ON CONFLICT (old_slug) DO UPDATE SET category_id = EXCLUDED.category_id, at = EXCLUDED.at", [String(before.slug), id, now()]);
    await run("DELETE FROM ref_category_redirects WHERE old_slug = $1", [slug]);
    await audit(actor, "Адрес категории изменён", `${id}: /${before.slug} → /${slug}, поставлена переадресация`);
  }
  await audit(actor, "Категория изменена", `${id}: ${nameRu}`);
  return id;
}

export async function moveCategory(actor: Staff, id: string, parentId: string | null, index: number) {
  if (!(await one("SELECT parent_id FROM ref_categories WHERE id = $1", [id]))) throw new Error("Категория не найдена.");
  if (parentId) {
    if (parentId === id) throw new Error("Категория не может быть вложена в себя.");
    let walker: string | null = parentId;
    while (walker) {
      if (walker === id) throw new Error("Нельзя вложить категорию в её собственную ветку.");
      const row: Row | null = await one("SELECT parent_id FROM ref_categories WHERE id = $1", [walker]);
      walker = (row?.parent_id as string | null) ?? null;
    }
    if ((await depthOf(parentId)) + (await subtreeHeight(id)) > MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
  }
  const rows = await many("SELECT id FROM ref_categories WHERE parent_id IS NOT DISTINCT FROM $1 AND id <> $2 ORDER BY sort_order, name_ru", [parentId, id]);
  const siblings = rows.map((item) => String(item.id));
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, id);
  await tx(async (client) => {
    await inTx.run(client, "UPDATE ref_categories SET parent_id = $1 WHERE id = $2", [parentId, id]);
    for (const [position, sibling] of siblings.entries()) {
      await inTx.run(client, "UPDATE ref_categories SET sort_order = $1 WHERE id = $2", [position + 1, sibling]);
    }
  });
  await audit(actor, "Порядок категорий изменён", `${id} → родитель ${parentId ?? "корень"}, позиция ${index + 1}`);
}

export async function deleteCategory(actor: Staff, id: string, moveTo: string | null) {
  const row = await one("SELECT name_ru FROM ref_categories WHERE id = $1", [id]);
  if (!row) throw new Error("Категория не найдена.");
  if (await one("SELECT id FROM ref_categories WHERE parent_id = $1", [id])) throw new Error("Сначала перенесите или удалите вложенные категории.");
  const counted = await one<{ count: string }>("SELECT COUNT(*) AS count FROM catalog_products WHERE category_id = $1", [id]);
  const parts = Number(counted?.count ?? 0);
  if (parts && !moveTo) throw new Error(`В категории ${parts} дет. Выберите, куда их перенести.`);
  if (parts && moveTo) {
    if (moveTo === id || !(await one("SELECT id FROM ref_categories WHERE id = $1", [moveTo]))) throw new Error("Выберите другую категорию для переноса.");
    await run("UPDATE catalog_products SET category_id = $1 WHERE category_id = $2", [moveTo, id]);
    await audit(actor, "Перенос деталей", `${parts} дет. из ${id} в ${moveTo}`);
  }
  await run("UPDATE ref_part_types SET category_id = NULL WHERE category_id = $1", [id]);
  await run("DELETE FROM ref_category_redirects WHERE category_id = $1", [id]);
  await run("DELETE FROM ref_categories WHERE id = $1", [id]);
  await audit(actor, "Категория удалена", `${id}: ${row.name_ru}`);
}

/* ---------- Типы деталей ---------- */

export type PartType = { id: string; nameRu: string; nameRo: string; categoryId: string | null; hasSide: boolean; hasPosition: boolean; assembly: boolean; assemblyIncludes: string; returnRestricted: boolean };

export async function listPartTypes(): Promise<PartType[]> {
  await ensureSeeded();
  const rows = await many("SELECT * FROM ref_part_types ORDER BY sort_order, name_ru");
  return rows.map((row) => ({
    id: String(row.id), nameRu: String(row.name_ru), nameRo: String(row.name_ro),
    categoryId: (row.category_id as string | null) ?? null,
    hasSide: Number(row.has_side) === 1, hasPosition: Number(row.has_position) === 1,
    assembly: Number(row.assembly) === 1, assemblyIncludes: String(row.assembly_includes),
    returnRestricted: Number(row.return_restricted) === 1,
  }));
}

export async function savePartType(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const nameRu = text(input.nameRu, 80, "Название RU", true);
  const nameRo = text(input.nameRo, 80, "Название RO");
  const includes = text(input.assemblyIncludes, 300, "Что входит в сборку");
  const categoryId = typeof input.categoryId === "string" && input.categoryId ? input.categoryId : null;
  if (categoryId && !(await one("SELECT id FROM ref_categories WHERE id = $1", [categoryId]))) throw new Error("Категория по умолчанию не найдена.");
  const fields = [nameRu, nameRo, categoryId, flag(input.hasSide), flag(input.hasPosition), flag(input.assembly), includes, flag(input.returnRestricted)];
  if (id) {
    if (!(await one("SELECT id FROM ref_part_types WHERE id = $1", [id]))) throw new Error("Тип детали не найден.");
    await run(
      "UPDATE ref_part_types SET name_ru=$1, name_ro=$2, category_id=$3, has_side=$4, has_position=$5, assembly=$6, assembly_includes=$7, return_restricted=$8 WHERE id=$9",
      [...fields, id],
    );
    await audit(actor, "Тип детали изменён", `${id}: ${nameRu}`);
    return id;
  }
  if (await one("SELECT id FROM ref_part_types WHERE lower(name_ru) = lower($1)", [nameRu])) throw new Error(`Тип «${nameRu}» уже есть в справочнике.`);
  const created = newId("type");
  const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_part_types");
  await run(
    `INSERT INTO ref_part_types (id,name_ru,name_ro,category_id,has_side,has_position,assembly,assembly_includes,return_restricted,sort_order,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [created, ...fields, Number(next?.next ?? 1), now()],
  );
  await audit(actor, "Тип детали создан", `${created}: ${nameRu}`);
  return created;
}

export async function deletePartType(actor: Staff, id: string) {
  const counted = await one<{ count: string }>("SELECT COUNT(*) AS count FROM catalog_products WHERE part_type_id = $1", [id]);
  const used = Number(counted?.count ?? 0);
  if (used) throw new Error(`Тип используется в ${used} дет. Сначала смените тип у этих деталей.`);
  const row = await one("SELECT name_ru FROM ref_part_types WHERE id = $1", [id]);
  if (!row) throw new Error("Тип детали не найден.");
  await run("DELETE FROM ref_part_types WHERE id = $1", [id]);
  await audit(actor, "Тип детали удалён", `${id}: ${row.name_ru}`);
}

export function partName(type: PartType, side: string, position: string) {
  const sideLabel = type.hasSide ? ({ left: "левая", right: "правая" } as Record<string, string>)[side] ?? "" : "";
  const positionLabel = type.hasPosition ? ({ front: "передняя", rear: "задняя" } as Record<string, string>)[position] ?? "" : "";
  return [type.nameRu, sideLabel, positionLabel].filter(Boolean).join(" ");
}

export function partNameRo(type: PartType, side: string, position: string) {
  if (!type.nameRo) return "";
  const sideLabel = type.hasSide ? ({ left: "stânga", right: "dreapta" } as Record<string, string>)[side] ?? "" : "";
  const positionLabel = type.hasPosition ? ({ front: "față", rear: "spate" } as Record<string, string>)[position] ?? "" : "";
  return [type.nameRo, sideLabel, positionLabel].filter(Boolean).join(" ");
}

/* ---------- Марки, модели, поколения ---------- */

export type Generation = { id: string; name: string; yearFrom: number | null; yearTo: number | null; engines: string; parts: number };
export type VehicleModel = { id: string; name: string; parts: number; generations: Generation[] };
export type VehicleMake = { id: string; name: string; logo: string; parts: number; models: VehicleModel[] };

export async function vehicleTree(): Promise<VehicleMake[]> {
  await ensureSeeded();
  const perModel = new Map<string, number>();
  for (const row of await many("SELECT model_id, COUNT(*) AS count FROM catalog_products WHERE model_id IS NOT NULL GROUP BY model_id")) {
    perModel.set(String(row.model_id), Number(row.count));
  }
  const generations = await many("SELECT * FROM ref_generations ORDER BY sort_order, year_from");
  const models = await many("SELECT * FROM ref_models ORDER BY sort_order, name");
  const makes = await many("SELECT * FROM ref_makes ORDER BY sort_order, name");
  return makes.map((make) => {
    const makeModels = models.filter((model) => String(model.make_id) === String(make.id)).map((model) => ({
      id: String(model.id), name: String(model.name), parts: perModel.get(String(model.id)) ?? 0,
      generations: generations.filter((generation) => String(generation.model_id) === String(model.id)).map((generation) => ({
        id: String(generation.id), name: String(generation.name),
        yearFrom: generation.year_from === null ? null : Number(generation.year_from),
        yearTo: generation.year_to === null ? null : Number(generation.year_to),
        engines: String(generation.engines), parts: 0,
      })),
    }));
    return { id: String(make.id), name: String(make.name), logo: String(make.logo), parts: makeModels.reduce((sum, model) => sum + model.parts, 0), models: makeModels };
  });
}

export async function saveMake(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Марка", true);
  const logo = typeof input.logo === "string" ? saveImage(input.logo) : "";
  if (id) {
    const existing = await one("SELECT logo FROM ref_makes WHERE id = $1", [id]);
    if (!existing) throw new Error("Марка не найдена.");
    await run("UPDATE ref_makes SET name = $1, logo = $2 WHERE id = $3", [name, logo || String(existing.logo ?? ""), id]);
    await audit(actor, "Марка изменена", `${id}: ${name}`);
    return id;
  }
  if (await one("SELECT id FROM ref_makes WHERE lower(name) = lower($1)", [name])) throw new Error(`Марка «${name}» уже есть.`);
  const created = newId("make");
  const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_makes");
  await run("INSERT INTO ref_makes (id,name,logo,sort_order,created_at) VALUES ($1,$2,$3,$4,$5)", [created, name, logo, Number(next?.next ?? 1), now()]);
  await audit(actor, "Марка создана", `${created}: ${name}`);
  return created;
}

export async function saveModel(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Модель", true);
  if (id) {
    if (!(await one("SELECT id FROM ref_models WHERE id = $1", [id]))) throw new Error("Модель не найдена.");
    await run("UPDATE ref_models SET name = $1 WHERE id = $2", [name, id]);
    await audit(actor, "Модель изменена", `${id}: ${name}`);
    return id;
  }
  const makeId = typeof input.makeId === "string" ? input.makeId : "";
  if (!(await one("SELECT id FROM ref_makes WHERE id = $1", [makeId]))) throw new Error("Марка не найдена.");
  if (await one("SELECT id FROM ref_models WHERE make_id = $1 AND lower(name) = lower($2)", [makeId, name])) throw new Error(`Модель «${name}» у этой марки уже есть.`);
  const created = newId("model");
  const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_models WHERE make_id = $1", [makeId]);
  await run("INSERT INTO ref_models (id,make_id,name,sort_order,created_at) VALUES ($1,$2,$3,$4,$5)", [created, makeId, name, Number(next?.next ?? 1), now()]);
  await audit(actor, "Модель создана", `${created}: ${name}`);
  return created;
}

export async function saveGeneration(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Поколение", true);
  const engines = text(input.engines, 200, "Двигатели");
  const year = (value: unknown) => {
    if (value === "" || value === null || value === undefined) return null;
    const result = Number(value);
    if (!Number.isInteger(result) || result < 1950 || result > 2100) throw new Error("Год должен быть между 1950 и 2100.");
    return result;
  };
  const yearFrom = year(input.yearFrom);
  const yearTo = year(input.yearTo);
  if (yearFrom && yearTo && yearTo < yearFrom) throw new Error("Год окончания раньше года начала.");
  if (id) {
    if (!(await one("SELECT id FROM ref_generations WHERE id = $1", [id]))) throw new Error("Поколение не найдено.");
    await run("UPDATE ref_generations SET name=$1, year_from=$2, year_to=$3, engines=$4 WHERE id=$5", [name, yearFrom, yearTo, engines, id]);
    await audit(actor, "Поколение изменено", `${id}: ${name}`);
    return id;
  }
  const modelId = typeof input.modelId === "string" ? input.modelId : "";
  if (!(await one("SELECT id FROM ref_models WHERE id = $1", [modelId]))) throw new Error("Модель не найдена.");
  const created = newId("gen");
  const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_generations WHERE model_id = $1", [modelId]);
  await run(
    "INSERT INTO ref_generations (id,model_id,name,year_from,year_to,engines,sort_order,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [created, modelId, name, yearFrom, yearTo, engines, Number(next?.next ?? 1), now()],
  );
  await audit(actor, "Поколение создано", `${created}: ${name}`);
  return created;
}

export async function deleteVehicle(actor: Staff, level: "make" | "model" | "generation", id: string) {
  if (level === "generation") {
    if (!(await run("DELETE FROM ref_generations WHERE id = $1", [id]))) throw new Error("Поколение не найдено.");
  } else if (level === "model") {
    const counted = await one<{ count: string }>("SELECT COUNT(*) AS count FROM catalog_products WHERE model_id = $1", [id]);
    const parts = Number(counted?.count ?? 0);
    if (parts) throw new Error(`К модели привязано ${parts} дет. Сначала открепите их.`);
    await run("DELETE FROM ref_generations WHERE model_id = $1", [id]);
    if (!(await run("DELETE FROM ref_models WHERE id = $1", [id]))) throw new Error("Модель не найдена.");
  } else {
    const models = await many("SELECT id FROM ref_models WHERE make_id = $1", [id]);
    if (models.length) throw new Error(`У марки ${models.length} модел. Сначала удалите их.`);
    if (!(await run("DELETE FROM ref_makes WHERE id = $1", [id]))) throw new Error("Марка не найдена.");
  }
  await audit(actor, "Удаление в справочнике машин", `${level} ${id}`);
}

/* ---------- Бренды новых запчастей ---------- */

export type PartBrand = { id: string; name: string; logo: string; description: string };

export async function listBrands(): Promise<PartBrand[]> {
  await ensureSeeded();
  const rows = await many("SELECT * FROM ref_brands ORDER BY sort_order, name");
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), logo: String(row.logo), description: String(row.description) }));
}

export async function saveBrand(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Название бренда", true);
  const description = text(input.description, 300, "Описание");
  const logo = typeof input.logo === "string" ? saveImage(input.logo) : "";
  if (id) {
    const existing = await one("SELECT logo FROM ref_brands WHERE id = $1", [id]);
    if (!existing) throw new Error("Бренд не найден.");
    await run("UPDATE ref_brands SET name=$1, logo=$2, description=$3 WHERE id=$4", [name, logo || String(existing.logo ?? ""), description, id]);
    await audit(actor, "Бренд изменён", `${id}: ${name}`);
    return id;
  }
  if (await one("SELECT id FROM ref_brands WHERE lower(name) = lower($1)", [name])) throw new Error(`Бренд «${name}» уже есть.`);
  const created = newId("brand");
  const next = await one<{ next: string }>("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_brands");
  await run("INSERT INTO ref_brands (id,name,logo,description,sort_order,created_at) VALUES ($1,$2,$3,$4,$5,$6)", [created, name, logo, description, Number(next?.next ?? 1), now()]);
  await audit(actor, "Бренд создан", `${created}: ${name}`);
  return created;
}

export async function deleteBrand(actor: Staff, id: string) {
  const row = await one("SELECT name FROM ref_brands WHERE id = $1", [id]);
  if (!row) throw new Error("Бренд не найден.");
  await run("DELETE FROM ref_brands WHERE id = $1", [id]);
  await audit(actor, "Бренд удалён", `${id}: ${row.name}`);
}

/* ---------- Файлы изображений ---------- */

/** Разбор и проверка картинки общая для публичного и закрытого хранилища. */
function decodeImage(value: string, maxBytes: number) {
  const match = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Неверный формат картинки.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 12) throw new Error("Файл картинки повреждён.");
  if (bytes.length > maxBytes) throw new Error(`Картинка тяжелее ${Math.round(maxBytes / 1000)} КБ после сжатия.`);
  const signature = bytes.toString("hex", 0, 4);
  const webp = signature === "52494646" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!(webp || signature.startsWith("ffd8ff") || signature === "89504e47")) throw new Error("Неверный формат картинки.");
  return { bytes, filename: `${randomBytes(16).toString("hex")}.${match[1] === "jpeg" ? "jpg" : match[1]}` };
}

export function saveImage(value: string, maxBytes = 600_000): string {
  if (!value) return "";
  if (value.startsWith("/uploads/")) return value;
  const { bytes, filename } = decodeImage(value, maxBytes);
  const directory = path.join(process.cwd(), "public", "uploads");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, filename), bytes, { flag: "wx" });
  return `/uploads/${filename}`;
}

/** Каталог закрытых файлов: лежит вне public, поэтому Next его сам не отдаёт. */
export const privateUploadDir = path.join(process.cwd(), "private-uploads");

/**
 * Фото выдачи — доказательство по конкретному заказу с лицами, номерами и адресом
 * на фоне. В public/uploads такой файл открывается по прямой ссылке кому угодно,
 * поэтому он пишется рядом, но вне public, и отдаётся только через маршрут с проверкой прав.
 */
export function savePrivateImage(value: string, maxBytes = 900_000): string {
  if (!value) return "";
  if (value.startsWith("/api/staff/issue-photo/") || value.startsWith("/uploads/")) return value;
  const { bytes, filename } = decodeImage(value, maxBytes);
  const directory = path.join(privateUploadDir, "issue");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, filename), bytes, { flag: "wx" });
  return `/api/staff/issue-photo/${filename}`;
}

/* ---------- Публичная витрина ---------- */

export type PublicCategory = { id: string; slug: string; name: string; intro: string; image: string; parts: number; seoTitle: string; seoDescription: string; children: { id: string; slug: string; name: string; image: string }[] };

export async function publicCategories(): Promise<PublicCategory[]> {
  const tree = await categoryTree();
  return tree.filter((node) => node.visible).map((node) => ({
    id: node.id, slug: node.slug, name: node.nameRu, intro: node.intro, image: node.image, parts: node.parts,
    seoTitle: node.seoTitle, seoDescription: node.seoDescription,
    children: node.children.filter((child) => child.visible).map((child) => ({ id: child.id, slug: child.slug, name: child.nameRu, image: child.image })),
  }));
}

export type CategoryLookup = { status: "ok" | "hidden"; id: string; slug: string; name: string; intro: string; seoTitle: string; seoDescription: string } | { status: "redirect"; slug: string } | null;

export async function findPublicCategory(slug: string): Promise<CategoryLookup> {
  if (!slug) return null;
  await ensureSeeded();
  const row = await one("SELECT id, slug, name_ru, intro, seo_title, seo_description, visible FROM ref_categories WHERE slug = $1", [slug]);
  if (row) {
    return {
      status: Number(row.visible) === 1 ? "ok" : "hidden",
      id: String(row.id), slug: String(row.slug), name: String(row.name_ru), intro: String(row.intro),
      seoTitle: String(row.seo_title), seoDescription: String(row.seo_description),
    };
  }
  const redirect = await one("SELECT c.slug AS slug FROM ref_category_redirects r JOIN ref_categories c ON c.id = r.category_id WHERE r.old_slug = $1", [slug]);
  return redirect ? { status: "redirect", slug: String(redirect.slug) } : null;
}

export async function publicBrands() {
  return (await listBrands()).filter((brand) => brand.logo || brand.description);
}

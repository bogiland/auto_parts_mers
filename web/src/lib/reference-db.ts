import "server-only";

import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getCheckoutCatalog } from "@/lib/checkout-db";
import { audit, type Staff } from "@/lib/staff-db";

type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number; lastInsertRowid: number | bigint } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };
const require = createRequire(import.meta.url);
let connection: Database | undefined;

function db(): Database {
  if (connection) return connection;
  getCheckoutCatalog();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  connection = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS ref_categories (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES ref_categories(id), slug TEXT NOT NULL UNIQUE, name_ru TEXT NOT NULL, name_ro TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS ref_categories_parent ON ref_categories(parent_id, sort_order);
    CREATE TABLE IF NOT EXISTS ref_category_redirects (old_slug TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES ref_categories(id), at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ref_part_types (id TEXT PRIMARY KEY, name_ru TEXT NOT NULL, name_ro TEXT NOT NULL DEFAULT '', category_id TEXT REFERENCES ref_categories(id), has_side INTEGER NOT NULL DEFAULT 0, has_position INTEGER NOT NULL DEFAULT 0, assembly INTEGER NOT NULL DEFAULT 0, assembly_includes TEXT NOT NULL DEFAULT '', return_restricted INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ref_makes (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ref_models (id TEXT PRIMARY KEY, make_id TEXT NOT NULL REFERENCES ref_makes(id), name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS ref_models_make ON ref_models(make_id, sort_order);
    CREATE TABLE IF NOT EXISTS ref_generations (id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES ref_models(id), name TEXT NOT NULL, year_from INTEGER, year_to INTEGER, engines TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS ref_generations_model ON ref_generations(model_id, sort_order);
    CREATE TABLE IF NOT EXISTS ref_brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`);
  for (const column of ["category_id TEXT", "part_type_id TEXT", "model_id TEXT"]) {
    const name = column.split(" ")[0];
    if (!connection.prepare("PRAGMA table_info(catalog_products)").all().some((info) => info.name === name)) connection.exec(`ALTER TABLE catalog_products ADD COLUMN ${column}`);
  }
  return connection;
}

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

function categoryRows() { return db().prepare("SELECT * FROM ref_categories ORDER BY sort_order, name_ru").all(); }

function partCounts() {
  const counts = new Map<string, { parts: number; inStock: number }>();
  for (const row of db().prepare("SELECT category_id, COUNT(*) AS parts, SUM(CASE WHEN stock>0 THEN 1 ELSE 0 END) AS in_stock FROM catalog_products WHERE category_id IS NOT NULL GROUP BY category_id").all()) {
    counts.set(String(row.category_id), { parts: Number(row.parts), inStock: Number(row.in_stock ?? 0) });
  }
  return counts;
}

export function categoryTree(): CategoryNode[] {
  const rows = categoryRows();
  const counts = partCounts();
  const build = (parentId: string | null, depth: number): CategoryNode[] => rows.filter((row) => (row.parent_id ?? null) === parentId).map((row) => {
    const id = String(row.id);
    const children = build(id, depth + 1);
    const own = counts.get(id) ?? { parts: 0, inStock: 0 };
    return {
      id, parentId, slug: String(row.slug), nameRu: String(row.name_ru), nameRo: String(row.name_ro), image: String(row.image), intro: String(row.intro),
      seoTitle: String(row.seo_title), seoDescription: String(row.seo_description), visible: Number(row.visible) === 1, depth,
      parts: own.parts + children.reduce((sum, child) => sum + child.parts, 0),
      inStock: own.inStock + children.reduce((sum, child) => sum + child.inStock, 0),
      children,
    };
  });
  return build(null, 1);
}

export function flatCategories() {
  const flatten = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((node) => [node, ...flatten(node.children)]);
  return flatten(categoryTree());
}

function depthOf(id: string | null): number {
  let depth = 0;
  let current = id;
  while (current) {
    depth += 1;
    if (depth > MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
    current = (db().prepare("SELECT parent_id FROM ref_categories WHERE id=?").get(current)?.parent_id as string | null) ?? null;
  }
  return depth;
}

function subtreeHeight(id: string): number {
  const children = db().prepare("SELECT id FROM ref_categories WHERE parent_id=?").all(id);
  return children.length ? 1 + Math.max(...children.map((child) => subtreeHeight(String(child.id)))) : 1;
}

export function saveCategory(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const nameRu = text(input.nameRu, 120, "Название RU", true);
  const nameRo = text(input.nameRo, 120, "Название RO");
  const intro = text(input.intro, 600, "Текст для страницы");
  const seoTitle = text(input.seoTitle, 160, "Заголовок для поиска");
  const seoDescription = text(input.seoDescription, 320, "Описание для поиска");
  const image = typeof input.image === "string" ? saveImage(input.image) : "";
  const visible = flag(input.visible);
  const parentId = typeof input.parentId === "string" && input.parentId ? input.parentId : null;
  if (parentId && !db().prepare("SELECT id FROM ref_categories WHERE id=?").get(parentId)) throw new Error("Родительская категория не найдена.");
  if (parentId && parentId === id) throw new Error("Категория не может быть вложена в себя.");
  const slug = slugify(typeof input.slug === "string" && input.slug.trim() ? input.slug : nameRu);
  if (slug.length < 2) throw new Error("Адрес страницы должен содержать хотя бы две латинские буквы.");
  const clash = db().prepare("SELECT id FROM ref_categories WHERE slug=? AND id<>?").get(slug, id ?? "");
  if (clash) throw new Error(`Адрес «${slug}» уже занят другой категорией.`);

  if (!id) {
    const parentDepth = parentId ? depthOf(parentId) : 0;
    if (parentDepth >= MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
    const order = Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_categories WHERE parent_id IS ?").get(parentId)?.next ?? 1);
    const created = newId("cat");
    db().prepare("INSERT INTO ref_categories(id,parent_id,slug,name_ru,name_ro,image,intro,seo_title,seo_description,visible,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(created, parentId, slug, nameRu, nameRo, image, intro, seoTitle, seoDescription, visible, order, now());
    audit(actor, "Категория создана", `${created}: ${nameRu} (/${slug})`);
    return created;
  }

  const before = db().prepare("SELECT slug,name_ru FROM ref_categories WHERE id=?").get(id);
  if (!before) throw new Error("Категория не найдена.");
  const keepImage = image || String(db().prepare("SELECT image FROM ref_categories WHERE id=?").get(id)?.image ?? "");
  db().prepare("UPDATE ref_categories SET parent_id=?,slug=?,name_ru=?,name_ro=?,image=?,intro=?,seo_title=?,seo_description=?,visible=? WHERE id=?")
    .run(parentId, slug, nameRu, nameRo, keepImage, intro, seoTitle, seoDescription, visible, id);
  if (String(before.slug) !== slug) {
    db().prepare("INSERT OR REPLACE INTO ref_category_redirects(old_slug,category_id,at) VALUES(?,?,?)").run(String(before.slug), id, now());
    db().prepare("DELETE FROM ref_category_redirects WHERE old_slug=?").run(slug);
    audit(actor, "Адрес категории изменён", `${id}: /${before.slug} → /${slug}, поставлена переадресация`);
  }
  audit(actor, "Категория изменена", `${id}: ${nameRu}`);
  return id;
}

export function moveCategory(actor: Staff, id: string, parentId: string | null, index: number) {
  const row = db().prepare("SELECT parent_id FROM ref_categories WHERE id=?").get(id);
  if (!row) throw new Error("Категория не найдена.");
  if (parentId) {
    if (parentId === id) throw new Error("Категория не может быть вложена в себя.");
    let walker: string | null = parentId;
    while (walker) {
      if (walker === id) throw new Error("Нельзя вложить категорию в её собственную ветку.");
      walker = (db().prepare("SELECT parent_id FROM ref_categories WHERE id=?").get(walker)?.parent_id as string | null) ?? null;
    }
    if (depthOf(parentId) + subtreeHeight(id) > MAX_DEPTH) throw new Error("Больше трёх уровней вложенности не поддерживается.");
  }
  const siblings = db().prepare("SELECT id FROM ref_categories WHERE parent_id IS ? AND id<>? ORDER BY sort_order, name_ru").all(parentId, id).map((item) => String(item.id));
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, id);
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE ref_categories SET parent_id=? WHERE id=?").run(parentId, id);
    siblings.forEach((sibling, position) => database.prepare("UPDATE ref_categories SET sort_order=? WHERE id=?").run(position + 1, sibling));
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  audit(actor, "Порядок категорий изменён", `${id} → родитель ${parentId ?? "корень"}, позиция ${index + 1}`);
}

export function deleteCategory(actor: Staff, id: string, moveTo: string | null) {
  const row = db().prepare("SELECT name_ru FROM ref_categories WHERE id=?").get(id);
  if (!row) throw new Error("Категория не найдена.");
  if (db().prepare("SELECT id FROM ref_categories WHERE parent_id=?").get(id)) throw new Error("Сначала перенесите или удалите вложенные категории.");
  const parts = Number(db().prepare("SELECT COUNT(*) AS count FROM catalog_products WHERE category_id=?").get(id)?.count ?? 0);
  if (parts && !moveTo) throw new Error(`В категории ${parts} дет. Выберите, куда их перенести.`);
  if (parts && moveTo) {
    if (moveTo === id || !db().prepare("SELECT id FROM ref_categories WHERE id=?").get(moveTo)) throw new Error("Выберите другую категорию для переноса.");
    db().prepare("UPDATE catalog_products SET category_id=? WHERE category_id=?").run(moveTo, id);
    audit(actor, "Перенос деталей", `${parts} дет. из ${id} в ${moveTo}`);
  }
  db().prepare("UPDATE ref_part_types SET category_id=NULL WHERE category_id=?").run(id);
  db().prepare("DELETE FROM ref_category_redirects WHERE category_id=?").run(id);
  db().prepare("DELETE FROM ref_categories WHERE id=?").run(id);
  audit(actor, "Категория удалена", `${id}: ${row.name_ru}`);
}

/* ---------- Типы деталей ---------- */

export type PartType = { id: string; nameRu: string; nameRo: string; categoryId: string | null; hasSide: boolean; hasPosition: boolean; assembly: boolean; assemblyIncludes: string; returnRestricted: boolean };

export function listPartTypes(): PartType[] {
  return db().prepare("SELECT * FROM ref_part_types ORDER BY sort_order, name_ru").all().map((row) => ({
    id: String(row.id), nameRu: String(row.name_ru), nameRo: String(row.name_ro), categoryId: (row.category_id as string | null) ?? null,
    hasSide: Number(row.has_side) === 1, hasPosition: Number(row.has_position) === 1, assembly: Number(row.assembly) === 1,
    assemblyIncludes: String(row.assembly_includes), returnRestricted: Number(row.return_restricted) === 1,
  }));
}

export function savePartType(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const nameRu = text(input.nameRu, 80, "Название RU", true);
  const nameRo = text(input.nameRo, 80, "Название RO");
  const includes = text(input.assemblyIncludes, 300, "Что входит в сборку");
  const categoryId = typeof input.categoryId === "string" && input.categoryId ? input.categoryId : null;
  if (categoryId && !db().prepare("SELECT id FROM ref_categories WHERE id=?").get(categoryId)) throw new Error("Категория по умолчанию не найдена.");
  const fields = [nameRu, nameRo, categoryId, flag(input.hasSide), flag(input.hasPosition), flag(input.assembly), includes, flag(input.returnRestricted)] as (string | number | null)[];
  if (id) {
    if (!db().prepare("SELECT id FROM ref_part_types WHERE id=?").get(id)) throw new Error("Тип детали не найден.");
    db().prepare("UPDATE ref_part_types SET name_ru=?,name_ro=?,category_id=?,has_side=?,has_position=?,assembly=?,assembly_includes=?,return_restricted=? WHERE id=?").run(...fields, id);
    audit(actor, "Тип детали изменён", `${id}: ${nameRu}`);
    return id;
  }
  if (db().prepare("SELECT id FROM ref_part_types WHERE lower(name_ru)=lower(?)").get(nameRu)) throw new Error(`Тип «${nameRu}» уже есть в справочнике.`);
  const created = newId("type");
  const order = Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_part_types").get()?.next ?? 1);
  db().prepare("INSERT INTO ref_part_types(id,name_ru,name_ro,category_id,has_side,has_position,assembly,assembly_includes,return_restricted,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(created, ...fields, order, now());
  audit(actor, "Тип детали создан", `${created}: ${nameRu}`);
  return created;
}

export function deletePartType(actor: Staff, id: string) {
  const used = Number(db().prepare("SELECT COUNT(*) AS count FROM catalog_products WHERE part_type_id=?").get(id)?.count ?? 0);
  if (used) throw new Error(`Тип используется в ${used} дет. Сначала смените тип у этих деталей.`);
  const row = db().prepare("SELECT name_ru FROM ref_part_types WHERE id=?").get(id);
  if (!row) throw new Error("Тип детали не найден.");
  db().prepare("DELETE FROM ref_part_types WHERE id=?").run(id);
  audit(actor, "Тип детали удалён", `${id}: ${row.name_ru}`);
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

export function vehicleTree(): VehicleMake[] {
  const perModel = new Map<string, number>();
  for (const row of db().prepare("SELECT model_id, COUNT(*) AS count FROM catalog_products WHERE model_id IS NOT NULL GROUP BY model_id").all()) perModel.set(String(row.model_id), Number(row.count));
  const generations = db().prepare("SELECT * FROM ref_generations ORDER BY sort_order, year_from").all();
  const models = db().prepare("SELECT * FROM ref_models ORDER BY sort_order, name").all();
  return db().prepare("SELECT * FROM ref_makes ORDER BY sort_order, name").all().map((make) => {
    const makeModels = models.filter((model) => String(model.make_id) === String(make.id)).map((model) => ({
      id: String(model.id), name: String(model.name), parts: perModel.get(String(model.id)) ?? 0,
      generations: generations.filter((generation) => String(generation.model_id) === String(model.id)).map((generation) => ({
        id: String(generation.id), name: String(generation.name), yearFrom: generation.year_from === null ? null : Number(generation.year_from),
        yearTo: generation.year_to === null ? null : Number(generation.year_to), engines: String(generation.engines), parts: 0,
      })),
    }));
    return { id: String(make.id), name: String(make.name), logo: String(make.logo), parts: makeModels.reduce((sum, model) => sum + model.parts, 0), models: makeModels };
  });
}

export function saveMake(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Марка", true);
  const logo = typeof input.logo === "string" ? saveImage(input.logo) : "";
  if (id) {
    const keep = logo || String(db().prepare("SELECT logo FROM ref_makes WHERE id=?").get(id)?.logo ?? "");
    if (!db().prepare("SELECT id FROM ref_makes WHERE id=?").get(id)) throw new Error("Марка не найдена.");
    db().prepare("UPDATE ref_makes SET name=?,logo=? WHERE id=?").run(name, keep, id);
    audit(actor, "Марка изменена", `${id}: ${name}`);
    return id;
  }
  if (db().prepare("SELECT id FROM ref_makes WHERE lower(name)=lower(?)").get(name)) throw new Error(`Марка «${name}» уже есть.`);
  const created = newId("make");
  db().prepare("INSERT INTO ref_makes(id,name,logo,sort_order,created_at) VALUES(?,?,?,?,?)").run(created, name, logo, Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_makes").get()?.next ?? 1), now());
  audit(actor, "Марка создана", `${created}: ${name}`);
  return created;
}

export function saveModel(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Модель", true);
  if (id) {
    if (!db().prepare("SELECT id FROM ref_models WHERE id=?").get(id)) throw new Error("Модель не найдена.");
    db().prepare("UPDATE ref_models SET name=? WHERE id=?").run(name, id);
    audit(actor, "Модель изменена", `${id}: ${name}`);
    return id;
  }
  const makeId = typeof input.makeId === "string" ? input.makeId : "";
  if (!db().prepare("SELECT id FROM ref_makes WHERE id=?").get(makeId)) throw new Error("Марка не найдена.");
  if (db().prepare("SELECT id FROM ref_models WHERE make_id=? AND lower(name)=lower(?)").get(makeId, name)) throw new Error(`Модель «${name}» у этой марки уже есть.`);
  const created = newId("model");
  db().prepare("INSERT INTO ref_models(id,make_id,name,sort_order,created_at) VALUES(?,?,?,?,?)").run(created, makeId, name, Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_models WHERE make_id=?").get(makeId)?.next ?? 1), now());
  audit(actor, "Модель создана", `${created}: ${name}`);
  return created;
}

export function saveGeneration(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Поколение", true);
  const engines = text(input.engines, 200, "Двигатели");
  const year = (value: unknown) => { if (value === "" || value === null || value === undefined) return null; const result = Number(value); if (!Number.isInteger(result) || result < 1950 || result > 2100) throw new Error("Год должен быть между 1950 и 2100."); return result; };
  const yearFrom = year(input.yearFrom);
  const yearTo = year(input.yearTo);
  if (yearFrom && yearTo && yearTo < yearFrom) throw new Error("Год окончания раньше года начала.");
  if (id) {
    if (!db().prepare("SELECT id FROM ref_generations WHERE id=?").get(id)) throw new Error("Поколение не найдено.");
    db().prepare("UPDATE ref_generations SET name=?,year_from=?,year_to=?,engines=? WHERE id=?").run(name, yearFrom, yearTo, engines, id);
    audit(actor, "Поколение изменено", `${id}: ${name}`);
    return id;
  }
  const modelId = typeof input.modelId === "string" ? input.modelId : "";
  if (!db().prepare("SELECT id FROM ref_models WHERE id=?").get(modelId)) throw new Error("Модель не найдена.");
  const created = newId("gen");
  db().prepare("INSERT INTO ref_generations(id,model_id,name,year_from,year_to,engines,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?)").run(created, modelId, name, yearFrom, yearTo, engines, Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_generations WHERE model_id=?").get(modelId)?.next ?? 1), now());
  audit(actor, "Поколение создано", `${created}: ${name}`);
  return created;
}

export function deleteVehicle(actor: Staff, level: "make" | "model" | "generation", id: string) {
  if (level === "generation") {
    if (!db().prepare("DELETE FROM ref_generations WHERE id=?").run(id).changes) throw new Error("Поколение не найдено.");
  } else if (level === "model") {
    const parts = Number(db().prepare("SELECT COUNT(*) AS count FROM catalog_products WHERE model_id=?").get(id)?.count ?? 0);
    if (parts) throw new Error(`К модели привязано ${parts} дет. Сначала открепите их.`);
    db().prepare("DELETE FROM ref_generations WHERE model_id=?").run(id);
    if (!db().prepare("DELETE FROM ref_models WHERE id=?").run(id).changes) throw new Error("Модель не найдена.");
  } else {
    const models = db().prepare("SELECT id FROM ref_models WHERE make_id=?").all(id);
    if (models.length) throw new Error(`У марки ${models.length} модел. Сначала удалите их.`);
    if (!db().prepare("DELETE FROM ref_makes WHERE id=?").run(id).changes) throw new Error("Марка не найдена.");
  }
  audit(actor, "Удаление в справочнике машин", `${level} ${id}`);
}

/* ---------- Бренды новых запчастей ---------- */

export type PartBrand = { id: string; name: string; logo: string; description: string };

export function listBrands(): PartBrand[] {
  return db().prepare("SELECT * FROM ref_brands ORDER BY sort_order, name").all().map((row) => ({ id: String(row.id), name: String(row.name), logo: String(row.logo), description: String(row.description) }));
}

export function saveBrand(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const name = text(input.name, 60, "Название бренда", true);
  const description = text(input.description, 300, "Описание");
  const logo = typeof input.logo === "string" ? saveImage(input.logo) : "";
  if (id) {
    const keep = logo || String(db().prepare("SELECT logo FROM ref_brands WHERE id=?").get(id)?.logo ?? "");
    if (!db().prepare("SELECT id FROM ref_brands WHERE id=?").get(id)) throw new Error("Бренд не найден.");
    db().prepare("UPDATE ref_brands SET name=?,logo=?,description=? WHERE id=?").run(name, keep, description, id);
    audit(actor, "Бренд изменён", `${id}: ${name}`);
    return id;
  }
  if (db().prepare("SELECT id FROM ref_brands WHERE lower(name)=lower(?)").get(name)) throw new Error(`Бренд «${name}» уже есть.`);
  const created = newId("brand");
  db().prepare("INSERT INTO ref_brands(id,name,logo,description,sort_order,created_at) VALUES(?,?,?,?,?,?)").run(created, name, logo, description, Number(db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM ref_brands").get()?.next ?? 1), now());
  audit(actor, "Бренд создан", `${created}: ${name}`);
  return created;
}

export function deleteBrand(actor: Staff, id: string) {
  const row = db().prepare("SELECT name FROM ref_brands WHERE id=?").get(id);
  if (!row) throw new Error("Бренд не найден.");
  db().prepare("DELETE FROM ref_brands WHERE id=?").run(id);
  audit(actor, "Бренд удалён", `${id}: ${row.name}`);
}

/* ---------- Файлы изображений ---------- */

export function saveImage(value: string, maxBytes = 600_000): string {
  if (!value) return "";
  if (value.startsWith("/uploads/")) return value;
  const match = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Неверный формат картинки.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 12) throw new Error("Файл картинки повреждён.");
  if (bytes.length > maxBytes) throw new Error(`Картинка тяжелее ${Math.round(maxBytes / 1000)} КБ после сжатия.`);
  const signature = bytes.toString("hex", 0, 4);
  const webp = signature === "52494646" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!(webp || signature.startsWith("ffd8ff") || signature === "89504e47")) throw new Error("Неверный формат картинки.");
  const directory = path.join(process.cwd(), "public", "uploads");
  mkdirSync(directory, { recursive: true });
  const filename = `${randomBytes(16).toString("hex")}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
  writeFileSync(path.join(directory, filename), bytes, { flag: "wx" });
  return `/uploads/${filename}`;
}

/* ---------- Публичная витрина ---------- */

export type PublicCategory = { id: string; slug: string; name: string; intro: string; image: string; parts: number; seoTitle: string; seoDescription: string; children: { id: string; slug: string; name: string; image: string }[] };

export function publicCategories(): PublicCategory[] {
  return categoryTree().filter((node) => node.visible).map((node) => ({
    id: node.id, slug: node.slug, name: node.nameRu, intro: node.intro, image: node.image, parts: node.parts,
    seoTitle: node.seoTitle, seoDescription: node.seoDescription,
    children: node.children.filter((child) => child.visible).map((child) => ({ id: child.id, slug: child.slug, name: child.nameRu, image: child.image })),
  }));
}

export type CategoryLookup = { status: "ok" | "hidden"; id: string; slug: string; name: string; intro: string; seoTitle: string; seoDescription: string } | { status: "redirect"; slug: string } | null;

export function findPublicCategory(slug: string): CategoryLookup {
  if (!slug) return null;
  const row = db().prepare("SELECT id,slug,name_ru,intro,seo_title,seo_description,visible FROM ref_categories WHERE slug=?").get(slug);
  if (row) return { status: Number(row.visible) === 1 ? "ok" : "hidden", id: String(row.id), slug: String(row.slug), name: String(row.name_ru), intro: String(row.intro), seoTitle: String(row.seo_title), seoDescription: String(row.seo_description) };
  const redirect = db().prepare("SELECT c.slug AS slug FROM ref_category_redirects r JOIN ref_categories c ON c.id=r.category_id WHERE r.old_slug=?").get(slug);
  return redirect ? { status: "redirect", slug: String(redirect.slug) } : null;
}

export function publicBrands() { return listBrands().filter((brand) => brand.logo || brand.description); }

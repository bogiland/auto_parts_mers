import "server-only";

import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getCheckoutCatalog } from "@/lib/checkout-db";
import { audit, type Staff } from "@/lib/staff-db";
import { listPartTypes, partName, partNameRo, saveImage, slugify, type PartType } from "@/lib/reference-db";
import { parsePhotos, type Photo } from "@/lib/photos";

type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };

const require = createRequire(import.meta.url);
let connection: Database | undefined;

function db(): Database {
  if (connection) return connection;
  getCheckoutCatalog();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const database = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS donors (id TEXT PRIMARY KEY, make_id TEXT, model_id TEXT, generation_id TEXT,
      make TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', generation TEXT NOT NULL DEFAULT '', year INTEGER,
      engine TEXT NOT NULL DEFAULT '', mileage INTEGER, note TEXT NOT NULL DEFAULT '',
      photos_json TEXT NOT NULL DEFAULT '[]', visible INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS donors_created ON donors(created_at DESC);
    CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS part_offers (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, supplier TEXT NOT NULL DEFAULT 'own',
      supplier_name TEXT NOT NULL DEFAULT 'Свой склад', price_mdl INTEGER, stock INTEGER NOT NULL DEFAULT 0,
      lead_days INTEGER, created_at TEXT NOT NULL, UNIQUE(product_id, supplier));
    CREATE INDEX IF NOT EXISTS part_offers_product ON part_offers(product_id);`);
  // Поля детали: артикул и адрес страницы ставятся один раз и больше не меняются.
  for (const column of ["sku TEXT", "donor_id TEXT", "condition TEXT", "location TEXT", "side TEXT", "position TEXT",
    "name_ro TEXT", "slug TEXT", "includes TEXT", "applicability TEXT", "created_at TEXT", "sold_at TEXT",
    "hidden INTEGER NOT NULL DEFAULT 0"]) {
    const name = column.split(" ")[0];
    if (!database.prepare("PRAGMA table_info(catalog_products)").all().some((info) => info.name === name)) database.exec(`ALTER TABLE catalog_products ADD COLUMN ${column}`);
  }
  connection = database;
  return database;
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString("hex")}`;

function text(value: unknown, limit: number, field: string, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && result.length < 1) throw new Error(`Заполните поле «${field}».`);
  if (result.length > limit) throw new Error(`Поле «${field}» длиннее ${limit} символов.`);
  return result;
}

function integer(value: unknown, field: string, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error(`Проверьте поле «${field}».`);
  return result;
}

/* ---------- Состояние детали ---------- */

export const conditions = [
  { id: "new", label: "Новая", labelRo: "Nouă" },
  { id: "good", label: "Б/у, хорошее", labelRo: "Folosită, stare bună" },
  { id: "defect", label: "С дефектом", labelRo: "Cu defect" },
  { id: "parts", label: "На запчасти", labelRo: "Pentru piese" },
] as const;
export const conditionLabel = (id: string) => conditions.find((item) => item.id === id)?.label ?? "";

/* ---------- Доноры ---------- */

export type Donor = {
  id: string; makeId: string | null; modelId: string | null; generationId: string | null;
  make: string; model: string; generation: string; year: number | null; engine: string;
  mileage: number | null; note: string; photos: Photo[]; visible: boolean; parts: number; createdAt: string;
};

export function donorTitle(donor: Pick<Donor, "make" | "model" | "generation" | "year">) {
  return [donor.make, donor.model, donor.generation, donor.year ? String(donor.year) : ""].filter(Boolean).join(" ");
}

function toDonor(row: Row): Donor {
  return {
    id: String(row.id), makeId: (row.make_id as string | null) ?? null, modelId: (row.model_id as string | null) ?? null,
    generationId: (row.generation_id as string | null) ?? null, make: String(row.make), model: String(row.model),
    generation: String(row.generation), year: row.year === null ? null : Number(row.year), engine: String(row.engine),
    mileage: row.mileage === null ? null : Number(row.mileage), note: String(row.note), photos: parsePhotos(row.photos_json),
    visible: Number(row.visible) === 1, parts: Number(row.parts ?? 0), createdAt: String(row.created_at),
  };
}

const donorSelect = `SELECT d.*, (SELECT COUNT(*) FROM catalog_products p WHERE p.donor_id=d.id) AS parts FROM donors d`;

export function listDonors(): Donor[] {
  return db().prepare(`${donorSelect} ORDER BY d.created_at DESC LIMIT 300`).all().map(toDonor);
}

/** Последние пять доноров: с них чаще всего снимают следующую деталь. */
export function recentDonors(limit = 5): Donor[] {
  return db().prepare(`${donorSelect} ORDER BY d.created_at DESC LIMIT ?`).all(limit).map(toDonor);
}

export function donorById(id: string): Donor | null {
  const row = db().prepare(`${donorSelect} WHERE d.id=?`).get(id);
  return row ? toDonor(row) : null;
}

export function saveDonor(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const make = text(input.make, 60, "Марка", true);
  const model = text(input.model, 60, "Модель");
  const generation = text(input.generation, 60, "Поколение");
  const engine = text(input.engine, 60, "Двигатель");
  const note = text(input.note, 500, "Заметка");
  const year = integer(input.year, "Год", 1950, new Date().getFullYear() + 1);
  const mileage = integer(input.mileage, "Пробег", 0, 2_000_000);
  const visible = input.visible === false || input.visible === "off" ? 0 : 1;
  const reference = (value: unknown) => (typeof value === "string" && value ? value : null);
  const photos = JSON.stringify(normalizePhotos(input.photos, 8));
  const fields = [reference(input.makeId), reference(input.modelId), reference(input.generationId), make, model, generation, year, engine, mileage, note, photos, visible] as (string | number | null)[];
  if (id) {
    const result = db().prepare("UPDATE donors SET make_id=?,model_id=?,generation_id=?,make=?,model=?,generation=?,year=?,engine=?,mileage=?,note=?,photos_json=?,visible=? WHERE id=?").run(...fields, id);
    if (!result.changes) throw new Error("Донор не найден.");
    audit(actor, "Правка донора", `${id}: ${make} ${model}`);
    return id;
  }
  const created = newId("donor");
  db().prepare("INSERT INTO donors(id,make_id,model_id,generation_id,make,model,generation,year,engine,mileage,note,photos_json,visible,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(created, ...fields, now());
  audit(actor, "Новый донор", `${created}: ${make} ${model} ${year ?? ""}`.trim());
  return created;
}

/* ---------- Фото ---------- */

// Обрезка и сжатие идут в браузере, поэтому EXIF до сервера не доходит, а оригинал нигде не хранится.
// Сервер принимает готовые куски: крупный план до 3000 px, обычный кадр до 2000 px и превью 400 px.
function normalizePhotos(value: unknown, limit: number): Photo[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Неверный список фото.");
  if (value.length > limit) throw new Error(`Можно загрузить до ${limit} фото.`);
  return value.map((item) => {
    const photo = typeof item === "string" ? { src: item, closeup: false, preview: "" } : (item as Photo);
    const closeup = Boolean(photo?.closeup);
    const src = saveImage(String(photo?.src ?? ""), closeup ? 1_600_000 : 900_000);
    if (!src) throw new Error("Одно из фото пустое.");
    return { src, closeup, preview: photo?.preview ? saveImage(String(photo.preview), 120_000) : "" };
  });
}

export function setPartPhotos(actor: Staff, id: string, value: unknown) {
  const photos = normalizePhotos(value, 6);
  const result = db().prepare("UPDATE catalog_products SET photos_json=? WHERE id=?").run(JSON.stringify(photos), id);
  if (!result.changes) throw new Error("Деталь не найдена.");
  audit(actor, "Фото детали", `${id}: ${photos.length} фото`);
  return photos;
}

/* ---------- Детали ---------- */

export type PartRow = {
  id: string; sku: string; nameRu: string; nameRo: string; slug: string;
  priceMdl: number | null; priceMode: string; stock: number; condition: string; location: string;
  donorId: string | null; donorTitle: string; categoryId: string | null; partTypeId: string | null;
  side: string; position: string; includes: string; applicability: string;
  photos: Photo[]; returnRestricted: boolean; hidden: boolean; soldAt: string | null; createdAt: string;
};

function toPart(row: Row): PartRow {
  return {
    id: String(row.id), sku: String(row.sku ?? ""), nameRu: String(row.name), nameRo: String(row.name_ro ?? ""),
    slug: String(row.slug ?? ""), priceMdl: row.price_mdl === null ? null : Number(row.price_mdl),
    priceMode: String(row.price_mode), stock: Number(row.stock), condition: String(row.condition ?? ""),
    location: String(row.location ?? ""), donorId: (row.donor_id as string | null) ?? null,
    donorTitle: String(row.donor_title ?? ""), categoryId: (row.category_id as string | null) ?? null,
    partTypeId: (row.part_type_id as string | null) ?? null, side: String(row.side ?? ""), position: String(row.position ?? ""),
    includes: String(row.includes ?? ""), applicability: String(row.applicability ?? ""), photos: parsePhotos(row.photos_json),
    returnRestricted: Number(row.return_restricted) === 1, hidden: Number(row.hidden ?? 0) === 1,
    soldAt: (row.sold_at as string | null) ?? null, createdAt: String(row.created_at ?? ""),
  };
}

const partSelect = `SELECT p.*, (SELECT CASE WHEN d.id IS NULL THEN '' ELSE
    trim(d.make || ' ' || d.model || ' ' || d.generation || ' ' || COALESCE(d.year,'')) END
  FROM donors d WHERE d.id=p.donor_id) AS donor_title FROM catalog_products p`;

export type PartFilter = "all" | "no_photo" | "no_price" | "no_ro" | "no_stock" | "stale";

export function listParts(filter: PartFilter = "all", query = ""): PartRow[] {
  const rows = db().prepare(`${partSelect} ORDER BY COALESCE(p.created_at,'') DESC, p.name LIMIT 500`).all().map(toPart);
  const stale = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const text = query.trim().toLowerCase();
  return rows.filter((part) => {
    if (text && !`${part.sku} ${part.nameRu} ${part.nameRo} ${part.donorTitle} ${part.location}`.toLowerCase().includes(text)) return false;
    if (filter === "no_photo") return !part.photos.length;
    if (filter === "no_price") return part.priceMode !== "fixed" || part.priceMdl === null;
    if (filter === "no_ro") return !part.nameRo;
    if (filter === "no_stock") return part.stock === 0;
    if (filter === "stale") return !part.soldAt || new Date(part.soldAt).getTime() < stale;
    return true;
  });
}

export function partById(id: string): PartRow | null {
  const row = db().prepare(`${partSelect} WHERE p.id=?`).get(id);
  return row ? toPart(row) : null;
}

export function partsOfDonor(donorId: string): PartRow[] {
  return db().prepare(`${partSelect} WHERE p.donor_id=? ORDER BY p.name`).all(donorId).map(toPart);
}

/** Артикул не меняется никогда: он выдаётся один раз из общего счётчика. */
function nextSku(): string {
  const database = db();
  database.prepare("INSERT OR IGNORE INTO counters(name,value) VALUES('sku',0)").run();
  database.prepare("UPDATE counters SET value=value+1 WHERE name='sku'").run();
  const value = Number(database.prepare("SELECT value FROM counters WHERE name='sku'").get()?.value ?? 1);
  return `NAA-${String(value).padStart(6, "0")}`;
}

function uniqueSlug(base: string): string {
  const root = base || "detal";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt ? `${root}-${attempt + 1}` : root;
    if (!db().prepare("SELECT id FROM catalog_products WHERE slug=?").get(candidate)) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

export function composeNames(type: PartType, side: string, position: string, donor: Donor | null) {
  const title = donor ? donorTitle(donor) : "";
  const ru = [partName(type, side, position), title].filter(Boolean).join(" ");
  const roBase = partNameRo(type, side, position);
  const ro = roBase ? [roBase, title].filter(Boolean).join(" ") : "";
  return { ru, ro };
}

/** Тот же донор, тот же тип и та же сторона — скорее всего деталь уже заведена. */
export function findDuplicate(donorId: string, partTypeId: string, side: string): PartRow | null {
  if (!donorId || !partTypeId) return null;
  const row = db().prepare(`${partSelect} WHERE p.donor_id=? AND p.part_type_id=? AND COALESCE(p.side,'')=? LIMIT 1`).get(donorId, partTypeId, side ?? "");
  return row ? toPart(row) : null;
}

export type NewPartResult = { id: string; sku: string; name: string; slug: string; donorId: string | null };

export function addPart(actor: Staff, input: Record<string, unknown>): NewPartResult {
  const typeId = text(input.partTypeId, 60, "Тип детали");
  const type = typeId ? listPartTypes().find((item) => item.id === typeId) ?? null : null;
  if (typeId && !type) throw new Error("Тип детали не найден в справочнике.");
  const side = type?.hasSide ? text(input.side, 10, "Сторона") : "";
  const position = type?.hasPosition ? text(input.position, 10, "Положение") : "";
  if (type?.hasSide && !["left", "right"].includes(side)) throw new Error("Укажите сторону: левая или правая.");
  if (type?.hasPosition && !["front", "rear"].includes(position)) throw new Error("Укажите положение: перед или зад.");
  const donorId = typeof input.donorId === "string" && input.donorId ? input.donorId : null;
  const donor = donorId ? donorById(donorId) : null;
  if (donorId && !donor) throw new Error("Донор не найден.");
  const condition = text(input.condition, 20, "Состояние", true);
  if (!conditions.some((item) => item.id === condition)) throw new Error("Выберите состояние детали.");
  const onRequest = input.priceOnRequest === true || input.priceOnRequest === "on";
  const price = onRequest ? null : integer(input.price, "Цена", 0, 10_000_000);
  if (!onRequest && price === null) throw new Error("Укажите цену или поставьте галочку «цена по запросу».");
  const stock = integer(input.stock, "Остаток", 0, 10_000) ?? 1;
  const location = text(input.location, 60, "Место на складе");
  const auto = type ? composeNames(type, side, position, donor) : { ru: "", ro: "" };
  // Для расходника без типа название вводят руками, для детали с донора оно собирается само.
  const extra = text(input.nameExtra, 80, "Уточнение");
  const nameRu = text(input.nameRu, 160, "Название RU") || text(input.name, 160, "Название") || [auto.ru, extra].filter(Boolean).join(" ");
  const nameRo = text(input.nameRo, 160, "Название RO") || auto.ro;
  if (nameRu.length < 3) throw new Error("Укажите тип детали или напишите название.");
  const includes = text(input.includes, 300, "Что входит") || (type?.assembly ? type.assemblyIncludes : "");
  const applicability = text(input.applicability, 300, "Применимость") || (donor ? donorTitle(donor) : "");
  const categoryId = (typeof input.categoryId === "string" && input.categoryId) || type?.categoryId || null;
  const returnRestricted = type?.returnRestricted || input.returnRestricted === true || input.returnRestricted === "on" ? 1 : 0;
  const productType = type?.nameRu || text(input.productType, 80, "Вид детали");
  const photos = JSON.stringify(normalizePhotos(input.photos, 6));

  const id = `part-${randomBytes(8).toString("hex")}`;
  const sku = nextSku();
  const slug = uniqueSlug(slugify(nameRu));
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(`INSERT INTO catalog_products
      (id,name,name_ro,slug,sku,price_mdl,stock,price_mode,return_restricted,product_type,category_id,part_type_id,model_id,
       donor_id,condition,location,side,position,includes,applicability,photos_json,hidden,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(id, nameRu, nameRo, slug, sku, price, stock, onRequest ? "on_request" : "fixed", returnRestricted, productType || null,
        categoryId, typeId || null, donor?.modelId ?? null, donorId, condition, location, side, position, includes, applicability, photos, now());
    // Сегодня предложение одно — свой склад. Таблица предложений позволит позже добавить поставщиков,
    // не трогая деталь: у каждого будет своя цена, остаток и срок.
    database.prepare("INSERT INTO part_offers(id,product_id,supplier,supplier_name,price_mdl,stock,lead_days,created_at) VALUES(?,?,'own','Свой склад',?,?,0,?)")
      .run(newId("offer"), id, price, stock, now());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  audit(actor, "Добавление детали", `${sku} ${id}: ${nameRu}`);
  return { id, sku, name: nameRu, slug, donorId };
}

export function updatePart(actor: Staff, input: Record<string, unknown>) {
  const id = text(input.id, 60, "Деталь", true);
  const before = partById(id);
  if (!before) throw new Error("Деталь не найдена.");
  const condition = text(input.condition, 20, "Состояние") || before.condition;
  const onRequest = input.priceOnRequest === true || input.priceOnRequest === "on";
  const price = onRequest ? null : integer(input.price, "Цена", 0, 10_000_000);
  const stock = integer(input.stock, "Остаток", 0, 10_000) ?? before.stock;
  const nameRu = text(input.nameRu, 160, "Название RU") || before.nameRu;
  const nameRo = text(input.nameRo, 160, "Название RO");
  const location = text(input.location, 60, "Место на складе");
  // Адрес страницы и артикул остаются прежними даже после переименования.
  db().prepare("UPDATE catalog_products SET name=?,name_ro=?,price_mdl=?,price_mode=?,stock=?,condition=?,location=?,includes=?,applicability=? WHERE id=?")
    .run(nameRu, nameRo, price, onRequest ? "on_request" : "fixed", stock, condition, location,
      text(input.includes, 300, "Что входит"), text(input.applicability, 300, "Применимость"), id);
  db().prepare("UPDATE part_offers SET price_mdl=?,stock=? WHERE product_id=? AND supplier='own'").run(price, stock, id);
  audit(actor, "Правка детали", `${before.sku || id}: ${nameRu}`);
}

export function setPartHidden(actor: Staff, id: string, hidden: boolean) {
  const result = db().prepare("UPDATE catalog_products SET hidden=? WHERE id=?").run(hidden ? 1 : 0, id);
  if (!result.changes) throw new Error("Деталь не найдена.");
  audit(actor, hidden ? "Деталь скрыта с сайта" : "Деталь снова на сайте", id);
}

export function setPartPrice(actor: Staff, id: string, price: number) {
  if (!Number.isSafeInteger(price) || price < 0) throw new Error("Неверная цена.");
  const before = db().prepare("SELECT price_mdl FROM catalog_products WHERE id=?").get(id);
  if (!before) throw new Error("Деталь не найдена.");
  db().prepare("UPDATE catalog_products SET price_mdl=?,price_mode='fixed' WHERE id=?").run(price, id);
  db().prepare("UPDATE part_offers SET price_mdl=? WHERE product_id=? AND supplier='own'").run(price, id);
  audit(actor, "Правка цены", `${id}: ${before.price_mdl ?? "по запросу"} → ${price} L.`);
}

/** Сколько деталей уже заведено по каждому типу: частые типы показываются сверху. */
export function partTypeUsage(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of db().prepare("SELECT part_type_id AS id, COUNT(*) AS count FROM catalog_products WHERE part_type_id IS NOT NULL GROUP BY part_type_id").all()) {
    result[String(row.id)] = Number(row.count);
  }
  return result;
}

/** Места на складе, которые уже использовались: подсказка при добавлении детали. */
export function locationSuggestions(): string[] {
  return db().prepare("SELECT DISTINCT location FROM catalog_products WHERE location IS NOT NULL AND location<>'' ORDER BY location LIMIT 40").all().map((row) => String(row.location));
}

/* ---------- Витрина ---------- */

/** Детали, заведённые владельцем: попадают в каталог и на страницу донора. Скрытые не показываются. */
export function publicParts(): PartRow[] {
  return db().prepare(`${partSelect} WHERE COALESCE(p.hidden,0)=0 AND p.sku IS NOT NULL ORDER BY COALESCE(p.created_at,'') DESC LIMIT 500`).all().map(toPart);
}

export type PublicDonor = Omit<Donor, "parts"> & { parts: PartRow[] };

/** Страница донора: сама машина и доступные с неё детали. */
export function publicDonor(id: string): PublicDonor | null {
  const donor = donorById(id);
  if (!donor || !donor.visible) return null;
  return { ...donor, parts: partsOfDonor(id).filter((part) => !part.hidden) };
}

export function publicDonors(): Donor[] {
  return listDonors().filter((donor) => donor.visible);
}

export function offersOfPart(productId: string) {
  return db().prepare("SELECT supplier,supplier_name,price_mdl,stock,lead_days FROM part_offers WHERE product_id=? ORDER BY supplier").all(productId).map((row) => ({
    supplier: String(row.supplier), supplierName: String(row.supplier_name),
    priceMdl: row.price_mdl === null ? null : Number(row.price_mdl), stock: Number(row.stock),
    leadDays: row.lead_days === null ? null : Number(row.lead_days),
  }));
}

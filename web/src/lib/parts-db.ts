import { legacyQuery, one, transaction } from "@/lib/db";
import "server-only";

import { randomBytes } from "node:crypto";
import { audit, type Staff } from "@/lib/staff-db";
import { listPartTypes, partName, partNameRo, saveImage, slugify, type PartType } from "@/lib/reference-db";
import { parsePhotos, type Photo } from "@/lib/photos";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodePartImage } from "@/lib/images";
import { AttrError, cleanAttrs, cleanCrossNumbers, nameHint, templatesFor, type Attrs, type CrossNumber } from "@/lib/attributes";
import { categoryPath, listAttrTemplates } from "@/lib/attributes-db";
import { isDemoTag, notDemo, showDemo } from "@/lib/demo";

type Row = Record<string, string | number | null>;

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

export async function listDonors(): Promise<Donor[]> {
  return (await legacyQuery.all<Row>(`${donorSelect} ORDER BY d.created_at DESC LIMIT 300`, [])).map(toDonor);
}

/** Последние пять доноров: с них чаще всего снимают следующую деталь. */
export async function recentDonors(limit = 5): Promise<Donor[]> {
  return (await legacyQuery.all<Row>(`${donorSelect} ORDER BY d.created_at DESC LIMIT ?`, [limit])).map(toDonor);
}

export async function donorById(id: string): Promise<Donor | null> {
  const row = (await legacyQuery.get<Row>(`${donorSelect} WHERE d.id=?`, [id]));
  return row ? toDonor(row) : null;
}

export async function saveDonor(actor: Staff, input: Record<string, unknown>) {
return (await transaction(async () => {
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
  const photos = JSON.stringify(await normalizePhotos(input.photos, 8));
  const fields = [reference(input.makeId), reference(input.modelId), reference(input.generationId), make, model, generation, year, engine, mileage, note, photos, visible] as (string | number | null)[];
  if (id) {
    const result = (await legacyQuery.run<Row>("UPDATE donors SET make_id=?,model_id=?,generation_id=?,make=?,model=?,generation=?,year=?,engine=?,mileage=?,note=?,photos_json=?,visible=? WHERE id=?", [...fields, id]));
    if (!result.changes) throw new Error("Донор не найден.");
    (await audit(actor, "Правка донора", `${id}: ${make} ${model}`));
    return id;
  }
  const created = newId("donor");
  (await legacyQuery.run<Row>("INSERT INTO donors(id,make_id,model_id,generation_id,make,model,generation,year,engine,mileage,note,photos_json,visible,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [created, ...fields, now()]));
  (await audit(actor, "Новый донор", `${created}: ${make} ${model} ${year ?? ""}`.trim()));
  return created;

}));
}

/* ---------- Фото ---------- */

// Обрезка и сжатие идут в браузере, но полагаться на это нельзя: запрос отправляют и в обход
// страницы. Поэтому сервер разбирает каждый кадр заново и пишет свой WebP (`lib/images`) —
// так отсекаются переименованные файлы и холсты-«бомбы», а EXIF с координатами не сохраняется.
//
// Фото детали пишется в трёх размерах (оригинал, превью 400, миниатюра 96) с понятным именем:
// fara-levaya-mercedes-benz-e-klass-w212-a2128200339-1.webp — по нему картинку находит поиск.
async function normalizePhotos(value: unknown, limit: number, naming?: { name: string; oem: string }): Promise<Photo[]> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("Неверный список фото.");
  if (value.length > limit) throw new Error(`Можно загрузить до ${limit} фото.`);
  const stored: Photo[] = [];
  for (const [index, item] of value.entries()) {
    const photo = typeof item === "string" ? { src: item, closeup: false, preview: "" } : (item as Photo);
    const closeup = Boolean(photo?.closeup);
    const raw = String(photo?.src ?? "");
    if (!raw) throw new Error("Одно из фото пустое.");
    if (raw.startsWith("/uploads/") || raw.startsWith("/images/")) {
      // Уже сохранённое фото: оставляем как есть вместе с его превью и миниатюрой.
      stored.push({ src: raw, closeup, preview: String(photo?.preview ?? ""), thumb: String(photo?.thumb ?? "") });
      continue;
    }
    if (!naming) {
      stored.push({ src: await saveImage(raw, closeup ? 1_600_000 : 900_000), closeup, preview: photo?.preview ? await saveImage(String(photo.preview), 120_000) : "" });
      continue;
    }
    const set = await encodePartImage(raw, closeup);
    const trim = (value: string) => value.replace(/^-+|-+$/g, "");
    const base = [trim(slugify(naming.name).slice(0, 50)), trim(slugify(naming.oem).slice(0, 20))].filter(Boolean).join("-") || "detal";
    const directory = path.join(process.cwd(), "public", "uploads", "parts");
    mkdirSync(directory, { recursive: true });
    let name = `${base}-${index + 1}`;
    for (let attempt = 2; existsSync(path.join(directory, `${name}.webp`)); attempt += 1) name = `${base}-${index + 1}-${attempt}`;
    writeFileSync(path.join(directory, `${name}.webp`), set.full, { flag: "wx" });
    writeFileSync(path.join(directory, `${name}-400.webp`), set.preview, { flag: "wx" });
    writeFileSync(path.join(directory, `${name}-96.webp`), set.thumb, { flag: "wx" });
    stored.push({ src: `/uploads/parts/${name}.webp`, preview: `/uploads/parts/${name}-400.webp`, thumb: `/uploads/parts/${name}-96.webp`, closeup });
  }
  return stored;
}

export async function setPartPhotos(actor: Staff, id: string, value: unknown) {
return (await transaction(async () => {
  const current = await legacyQuery.get<Row>("SELECT name, oem_number FROM catalog_products WHERE id=?", [id]);
  if (!current) throw new Error("Деталь не найдена.");
  const photos = await normalizePhotos(value, 10, { name: String(current.name), oem: String(current.oem_number ?? "") });
  const result = (await legacyQuery.run<Row>("UPDATE catalog_products SET photos_json=? WHERE id=?", [JSON.stringify(photos), id]));
  if (!result.changes) throw new Error("Деталь не найдена.");
  (await audit(actor, "Фото детали", `${id}: ${photos.length} фото`));
  return photos;

}));
}

/* ---------- Детали ---------- */

export type PartRow = {
  id: string; sku: string; oem: string; nameRu: string; nameRo: string; slug: string;
  priceMdl: number | null; priceMode: string; stock: number; condition: string; location: string;
  donorId: string | null; donorTitle: string; brandId: string | null; brandName: string; categoryId: string | null; partTypeId: string | null;
  side: string; position: string; includes: string; applicability: string;
  photos: Photo[]; returnRestricted: boolean; hidden: boolean; soldAt: string | null; createdAt: string;
  /** П6: характеристики по шаблону, кросс-номера, состояние словами. */
  attrs: Attrs; crossNumbers: CrossNumber[]; conditionNote: string;
  /** Деталь из демонабора: на витрине видна только при NAA_SHOW_DEMO=1. */
  demo: boolean;
  /** Тип детали: название и флаги из справочника. «Без возврата» и «расходник» берутся оттуда. */
  partTypeName: string; typeReturnRestricted: boolean; consumable: boolean;
  /** Донор целиком: происхождение детали — марка, модель, кузов, год, мотор. */
  donor: { make: string; model: string; generation: string; year: number | null; engine: string } | null;
};

function toPart(row: Row): PartRow {
  return {
    id: String(row.id), sku: String(row.sku ?? ""), oem: String(row.oem_number ?? ""), nameRu: String(row.name), nameRo: String(row.name_ro ?? ""),
    slug: String(row.slug ?? ""), priceMdl: row.price_mdl === null ? null : Number(row.price_mdl),
    priceMode: String(row.price_mode), stock: Number(row.stock), condition: String(row.condition ?? ""),
    location: String(row.location ?? ""), donorId: (row.donor_id as string | null) ?? null,
    donorTitle: String(row.donor_title ?? ""), brandId: (row.brand_id as string | null) ?? null, brandName: String(row.brand_name ?? ""),
    categoryId: (row.category_id as string | null) ?? null,
    partTypeId: (row.part_type_id as string | null) ?? null, side: String(row.side ?? ""), position: String(row.position ?? ""),
    includes: String(row.includes ?? ""), applicability: String(row.applicability ?? ""), photos: parsePhotos(row.photos_json),
    returnRestricted: Number(row.return_restricted) === 1, hidden: Number(row.hidden ?? 0) === 1,
    soldAt: (row.sold_at as string | null) ?? null, createdAt: String(row.created_at ?? ""),
    demo: isDemoTag(row.demo_tag),
    attrs: jsonObject(row.attrs), crossNumbers: jsonArray(row.cross_numbers) as CrossNumber[], conditionNote: String(row.condition_note ?? ""),
    partTypeName: String(row.type_name ?? ""), typeReturnRestricted: Number(row.type_return ?? 0) === 1, consumable: Number(row.type_consumable ?? 0) === 1,
    donor: row.donor_make ? { make: String(row.donor_make), model: String(row.donor_model ?? ""), generation: String(row.donor_generation ?? ""), year: row.donor_year === null || row.donor_year === undefined ? null : Number(row.donor_year), engine: String(row.donor_engine ?? "") } : null,
  };
}

function jsonObject(value: unknown): Attrs {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Attrs;
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
  return {};
}
function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}

const partSelect = `SELECT p.*, (SELECT b.name FROM ref_brands b WHERE b.id = p.brand_id) AS brand_name, (SELECT CASE WHEN d.id IS NULL THEN '' ELSE
    trim(d.make || ' ' || d.model || ' ' || d.generation || ' ' || COALESCE(d.year::text,'')) END
  FROM donors d WHERE d.id=p.donor_id) AS donor_title,
  d2.make AS donor_make, d2.model AS donor_model, d2.generation AS donor_generation, d2.year AS donor_year, d2.engine AS donor_engine,
  t.name_ru AS type_name, t.return_restricted AS type_return, t.consumable AS type_consumable
  FROM catalog_products p LEFT JOIN donors d2 ON d2.id = p.donor_id LEFT JOIN ref_part_types t ON t.id = p.part_type_id`;

export type PartFilter = "all" | "no_photo" | "no_price" | "no_ro" | "no_stock" | "stale";

export async function listParts(filter: PartFilter = "all", query = ""): Promise<PartRow[]> {
  const rows = (await legacyQuery.all<Row>(`${partSelect} ORDER BY COALESCE(p.created_at,'') DESC, p.name LIMIT 500`, [])).map(toPart);
  const stale = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const text = query.trim().toLowerCase();
  return rows.filter((part) => {
    if (text && !`${part.sku} ${part.oem} ${part.nameRu} ${part.nameRo} ${part.donorTitle} ${part.location}`.toLowerCase().includes(text)) return false;
    if (filter === "no_photo") return !part.photos.length;
    if (filter === "no_price") return part.priceMode !== "fixed" || part.priceMdl === null;
    if (filter === "no_ro") return !part.nameRo;
    if (filter === "no_stock") return part.stock === 0;
    if (filter === "stale") return !part.soldAt || new Date(part.soldAt).getTime() < stale;
    return true;
  });
}

export async function partById(id: string): Promise<PartRow | null> {
  const row = (await legacyQuery.get<Row>(`${partSelect} WHERE p.id=?`, [id]));
  return row ? toPart(row) : null;
}

/** Public product links use the readable slug; old internal-ID links keep working too. */
export async function partByPublicId(value: string): Promise<PartRow | null> {
  const row = (await legacyQuery.get<Row>(`${partSelect} WHERE p.id=? OR p.slug=? LIMIT 1`, [value, value]));
  return row ? toPart(row) : null;
}

export async function partsOfDonor(donorId: string): Promise<PartRow[]> {
  return (await legacyQuery.all<Row>(`${partSelect} WHERE p.donor_id=? ORDER BY p.name`, [donorId])).map(toPart);
}

/** Артикул не меняется никогда: он выдаётся один раз из общего счётчика. */
async function nextSku(): Promise<string> {
return (await transaction(async () => {
  
  (await legacyQuery.run<Row>("INSERT OR IGNORE INTO counters(name,value) VALUES('sku',0)", []));
  (await legacyQuery.run<Row>("UPDATE counters SET value=value+1 WHERE name='sku'", []));
  const value = Number((await legacyQuery.get<Row>("SELECT value FROM counters WHERE name='sku'", []))?.value ?? 1);
  return `NAA-${String(value).padStart(6, "0")}`;

}));
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "detal";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt ? `${root}-${attempt + 1}` : root;
    if (!(await legacyQuery.get<Row>("SELECT id FROM catalog_products WHERE slug=?", [candidate]))) return candidate;
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
export async function findDuplicate(donorId: string, partTypeId: string, side: string): Promise<PartRow | null> {
  if (!donorId || !partTypeId) return null;
  const row = (await legacyQuery.get<Row>(`${partSelect} WHERE p.donor_id=? AND p.part_type_id=? AND COALESCE(p.side,'')=? LIMIT 1`, [donorId, partTypeId, side ?? ""]));
  return row ? toPart(row) : null;
}

export type NewPartResult = { id: string; sku: string; name: string; slug: string; donorId: string | null };

/**
 * Новая деталь. Обязательных полей четыре — их вносит отец с телефона за минуту:
 * тип детали (из него сама ставится категория), бренд детали, хотя бы одно фото,
 * цена или отметка «по запросу». Внутренний артикул NAA-000123 выдаётся сам.
 * Всё остальное (OEM, кроссы, характеристики, состояние словами) необязательно и дозаполняется потом.
 */
export async function addPart(actor: Staff, input: Record<string, unknown>): Promise<NewPartResult> {
return (await transaction(async () => {
  const typeId = text(input.partTypeId, 60, "Тип детали");
  if (!typeId) throw new Error("Выберите тип детали: из него сама поставится категория.");
  const type = (await listPartTypes()).find((item) => item.id === typeId) ?? null;
  if (!type) throw new Error("Тип детали не найден в справочнике.");
  const brandId = await resolveBrand(input.brandId);
  if (!brandId) throw new Error("Укажите бренд детали — производителя: Bosch, Zimmermann, Mercedes-Benz.");
  if (!Array.isArray(input.photos) || input.photos.length < 1) throw new Error("Добавьте хотя бы одно фото детали.");
  const side = type.hasSide ? text(input.side, 10, "Сторона") : "";
  const position = type.hasPosition ? text(input.position, 10, "Положение") : "";
  if (side && !["left", "right"].includes(side)) throw new Error("Сторона: левая или правая.");
  if (position && !["front", "rear"].includes(position)) throw new Error("Положение: перед или зад.");
  const donorId = typeof input.donorId === "string" && input.donorId ? input.donorId : null;
  const donor = donorId ? (await donorById(donorId)) : null;
  if (donorId && !donor) throw new Error("Донор не найден.");
  // Состояние необязательно: не выбрали — карточка его просто не показывает.
  const condition = text(input.condition, 20, "Состояние");
  if (condition && !conditions.some((item) => item.id === condition)) throw new Error("Выберите состояние детали из списка.");
  const onRequest = input.priceOnRequest === true || input.priceOnRequest === "on";
  const price = onRequest ? null : integer(input.price, "Цена", 0, 10_000_000);
  if (!onRequest && price === null) throw new Error("Укажите цену или поставьте галочку «цена по запросу».");
  const stock = integer(input.stock, "Остаток", 0, 10_000) ?? 1;
  const location = text(input.location, 60, "Место на складе");
  const oem = text(input.oem, 40, "Номер OEM");
  const conditionNote = text(input.conditionNote, 200, "Состояние словами");
  const categoryId = (typeof input.categoryId === "string" && input.categoryId) || type.categoryId || null;
  let attrs: Attrs, crossNumbers: CrossNumber[], hint: string;
  try {
    const templates = templatesFor(await listAttrTemplates(), await categoryPath(categoryId), typeId);
    attrs = cleanAttrs(input.attrs, templates);
    crossNumbers = cleanCrossNumbers(input.crossNumbers);
    hint = nameHint("", templates, attrs);
  } catch (error) { if (error instanceof AttrError) throw new Error(error.message); throw error; }
  const auto = composeNames(type, side, position, donor);
  const extra = text(input.nameExtra, 80, "Уточнение");
  // Подсказка названия: тип + отмеченные характеристики + донор («Тормозной диск передний 320 мм вентилируемый W212»).
  const suggested = [composeNames(type, side, position, null).ru, hint, extra, donor ? donorTitle(donor) : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const nameRu = text(input.nameRu, 160, "Название RU") || text(input.name, 160, "Название") || suggested || auto.ru;
  const nameRo = text(input.nameRo, 160, "Название RO") || auto.ro;
  const includes = text(input.includes, 300, "Что входит") || (type.assembly ? type.assemblyIncludes : "");
  const applicability = text(input.applicability, 300, "Применимость") || (donor ? donorTitle(donor) : "");
  // «Без возврата» — с типа детали; новый расходник возврату не подлежит всегда.
  const returnRestricted = type.returnRestricted || (condition === "new" && type.consumable) || input.returnRestricted === true || input.returnRestricted === "on" ? 1 : 0;
  const photos = JSON.stringify(await normalizePhotos(input.photos, 10, { name: nameRu, oem }));

  const id = `part-${randomBytes(8).toString("hex")}`;
  const sku = (await nextSku());
  const slug = (await uniqueSlug(slugify(nameRu)));
  await legacyQuery.run<Row>(`INSERT INTO catalog_products
    (id,name,name_ro,slug,sku,oem_number,price_mdl,stock,price_mode,return_restricted,product_type,category_id,part_type_id,model_id,
     donor_id,brand_id,condition,location,side,position,includes,applicability,photos_json,hidden,created_at,attrs,cross_numbers,condition_note)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`, [id, nameRu, nameRo, slug, sku, oem || null, price, stock, onRequest ? "on_request" : "fixed", returnRestricted, type.nameRu, categoryId, typeId, donor?.modelId ?? null, donorId, brandId, condition || null, location, side, position, includes, applicability, photos, now(), JSON.stringify(attrs), JSON.stringify(crossNumbers), conditionNote]);
  // Сегодня предложение одно — свой склад. Таблица предложений позволит позже добавить поставщиков.
  await legacyQuery.run<Row>("INSERT INTO part_offers(id,product_id,supplier,supplier_name,price_mdl,stock,lead_days,created_at) VALUES(?,?,'own','Свой склад',?,?,0,?)", [newId("offer"), id, price, stock, now()]);
  await audit(actor, "Добавление детали", `${sku} ${id}: ${nameRu}`);
  return { id, sku, name: nameRu, slug, donorId };
}));
}

export async function updatePart(actor: Staff, input: Record<string, unknown>) {
return (await transaction(async () => {
  const id = text(input.id, 60, "Деталь", true);
  const before = (await partById(id));
  if (!before) throw new Error("Деталь не найдена.");
  const condition = text(input.condition, 20, "Состояние") || before.condition;
  const onRequest = input.priceOnRequest === true || input.priceOnRequest === "on";
  const price = onRequest ? null : integer(input.price, "Цена", 0, 10_000_000);
  const stock = integer(input.stock, "Остаток", 0, 10_000) ?? before.stock;
  const nameRu = text(input.nameRu, 160, "Название RU") || before.nameRu;
  const nameRo = text(input.nameRo, 160, "Название RO");
  const location = text(input.location, 60, "Место на складе");
  // Бренд меняется только если его прислали: пустое поле в форме правки не стирает уже заведённый.
  const brandId = input.brandId === undefined ? before.brandId : await resolveBrand(input.brandId);
  // Поля П6 меняются только если их прислали: старая форма без них ничего не стирает.
  const oem = input.oem === undefined ? before.oem : text(input.oem, 40, "Номер OEM");
  const conditionNote = input.conditionNote === undefined ? before.conditionNote : text(input.conditionNote, 200, "Состояние словами");
  let attrs = before.attrs, crossNumbers = before.crossNumbers;
  try {
    if (input.attrs !== undefined) attrs = cleanAttrs(input.attrs, templatesFor(await listAttrTemplates(), await categoryPath(before.categoryId), before.partTypeId), before.attrs);
    if (input.crossNumbers !== undefined) crossNumbers = cleanCrossNumbers(input.crossNumbers);
  } catch (error) { if (error instanceof AttrError) throw new Error(error.message); throw error; }
  const includes = input.includes === undefined ? before.includes : text(input.includes, 300, "Что входит");
  const applicability = input.applicability === undefined ? before.applicability : text(input.applicability, 300, "Применимость");
  // Адрес страницы и артикул остаются прежними даже после переименования.
  (await legacyQuery.run<Row>("UPDATE catalog_products SET name=?,name_ro=?,price_mdl=?,price_mode=?,stock=?,condition=?,location=?,includes=?,applicability=?,brand_id=?,oem_number=?,condition_note=?,attrs=?,cross_numbers=? WHERE id=?", [nameRu, nameRo, price, onRequest ? "on_request" : "fixed", stock, condition, location, includes, applicability, brandId, oem || null, conditionNote, JSON.stringify(attrs), JSON.stringify(crossNumbers), id]));
  (await legacyQuery.run<Row>("UPDATE part_offers SET price_mdl=?,stock=? WHERE product_id=? AND supplier='own'", [price, stock, id]));
  (await audit(actor, "Правка детали", `${before.sku || id}: ${nameRu}`));

}));
}

export async function setPartHidden(actor: Staff, id: string, hidden: boolean) {
return (await transaction(async () => {
  const result = (await legacyQuery.run<Row>("UPDATE catalog_products SET hidden=? WHERE id=?", [hidden ? 1 : 0, id]));
  if (!result.changes) throw new Error("Деталь не найдена.");
  (await audit(actor, hidden ? "Деталь скрыта с сайта" : "Деталь снова на сайте", id));

}));
}

export async function setPartPrice(actor: Staff, id: string, price: number) {
return (await transaction(async () => {
  if (!Number.isSafeInteger(price) || price < 0) throw new Error("Неверная цена.");
  const before = (await legacyQuery.get<Row>("SELECT price_mdl FROM catalog_products WHERE id=?", [id]));
  if (!before) throw new Error("Деталь не найдена.");
  (await legacyQuery.run<Row>("UPDATE catalog_products SET price_mdl=?,price_mode='fixed' WHERE id=?", [price, id]));
  (await legacyQuery.run<Row>("UPDATE part_offers SET price_mdl=? WHERE product_id=? AND supplier='own'", [price, id]));
  (await audit(actor, "Правка цены", `${id}: ${before.price_mdl ?? "по запросу"} → ${price} руб.`));

}));
}

/** Сколько деталей уже заведено по каждому типу: частые типы показываются сверху. */
export async function partTypeUsage(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const row of (await legacyQuery.all<Row>("SELECT part_type_id AS id, COUNT(*) AS count FROM catalog_products WHERE part_type_id IS NOT NULL GROUP BY part_type_id", []))) {
    result[String(row.id)] = Number(row.count);
  }
  return result;
}

/** Места на складе, которые уже использовались: подсказка при добавлении детали. */
export async function locationSuggestions(): Promise<string[]> {
  return (await legacyQuery.all<Row>("SELECT DISTINCT location FROM catalog_products WHERE location IS NOT NULL AND location<>'' ORDER BY location LIMIT 40", [])).map((row) => String(row.location));
}

/* ---------- Витрина ---------- */

/** Детали, заведённые владельцем: попадают в каталог и на страницу донора. Скрытые не показываются. */
export async function publicParts(): Promise<PartRow[]> {
  return (await legacyQuery.all<Row>(`${partSelect} WHERE COALESCE(p.hidden,0)=0 AND p.sku IS NOT NULL AND ${notDemo("p")} ORDER BY COALESCE(p.created_at,'') DESC`, [])).map(toPart);
}

export type PublicDonor = Omit<Donor, "parts"> & { parts: PartRow[] };

/** Страница донора: сама машина и доступные с неё детали. */
export async function publicDonor(id: string): Promise<PublicDonor | null> {
  const donor = (await donorById(id));
  if (!donor || !donor.visible) return null;
  const row = await one<{ demo_tag: string | null }>("SELECT demo_tag FROM donors WHERE id = $1", [id]);
  if (isDemoTag(row?.demo_tag) && !showDemo()) return null;
  return { ...donor, parts: (await partsOfDonor(id)).filter((part) => !part.hidden && (showDemo() || !part.demo)) };
}

export async function publicDonors(): Promise<Donor[]> {
  return (await legacyQuery.all<Row>(`${donorSelect} WHERE d.visible=1 AND ${notDemo("d")} ORDER BY d.created_at DESC`, [])).map(toDonor);
}

export async function offersOfPart(productId: string) {
  return (await legacyQuery.all<Row>("SELECT supplier,supplier_name,price_mdl,stock,lead_days FROM part_offers WHERE product_id=? ORDER BY supplier", [productId])).map((row) => ({
    supplier: String(row.supplier), supplierName: String(row.supplier_name),
    priceMdl: row.price_mdl === null ? null : Number(row.price_mdl), stock: Number(row.stock),
    leadDays: row.lead_days === null ? null : Number(row.lead_days),
  }));
}

/**
 * Старый адрес карточки. Пары «X» и «recommended-X» появились из-за того, что
 * рекомендованные детали лежали в наборе отдельными записями с тем же артикулом.
 * Дубль скрыт с витрины, а его адрес ведёт на основную карточку постоянной
 * переадресацией — старые ссылки из переписки и поиска продолжают работать.
 */
export async function productRedirect(oldId: string): Promise<string | null> {
  if (!oldId) return null;
  const row = await one<{ product_id: string }>("SELECT product_id FROM product_redirects WHERE old_id = $1", [oldId]);
  return row ? String(row.product_id) : null;
}

/**
 * Бренд детали по идентификатору из справочника.
 *
 * Бренд — производитель детали: Bosch, Zimmermann, Mercedes-Benz. Донор — машина,
 * с которой деталь снята: он хранится отдельно, в `donor_id`. Раньше витрина
 * показывала донора в поле «Производитель», и в фильтре вперемешку стояли
 * «Mercedes-Benz E-класс W212 2013» и «NAA.md».
 *
 * Пустое значение разрешено: владелец сказал, что обязательных полей должно быть
 * минимум, остальное дозаполняется потом. Несуществующий идентификатор — ошибка,
 * иначе опечатка тихо обнулила бы бренд.
 */
async function resolveBrand(value: unknown): Promise<string | null> {
  if (typeof value !== "string" || !value.trim()) return null;
  const row = await one<{ id: string }>("SELECT id FROM ref_brands WHERE id = $1", [value.trim()]);
  if (!row) throw new Error("Бренд не найден в справочнике.");
  return String(row.id);
}

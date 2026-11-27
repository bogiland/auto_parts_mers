import "server-only";

import { many, one, run } from "@/lib/db";
import { audit, type Staff } from "@/lib/staff-db";
import type { AttrTemplate } from "@/lib/attributes";

type Row = Record<string, unknown>;

function toTemplate(row: Row): AttrTemplate {
  return {
    id: String(row.id), categoryId: (row.category_id as string | null) ?? null, partTypeId: (row.part_type_id as string | null) ?? null,
    key: String(row.key), labelRu: String(row.label_ru), labelRo: String(row.label_ro ?? ""), kind: row.kind as AttrTemplate["kind"],
    unit: String(row.unit ?? ""), options: Array.isArray(row.options) ? (row.options as unknown[]).map(String) : [],
    filterable: Boolean(row.filterable), inName: Boolean(row.in_name), sortOrder: Number(row.sort_order ?? 0),
  };
}

/** Весь шаблон целиком: он маленький (десятки строк), форма и витрина фильтруют его сами. */
export async function listAttrTemplates(): Promise<AttrTemplate[]> {
  return (await many<Row>("SELECT * FROM ref_attr_templates ORDER BY sort_order, label_ru")).map(toTemplate);
}

/** Категория и все её родители, от самой узкой к основной. */
export async function categoryPath(categoryId: string | null): Promise<string[]> {
  if (!categoryId) return [];
  const rows = await many<{ id: string }>(
    `WITH RECURSIVE up AS (SELECT id, parent_id, 0 AS depth FROM ref_categories WHERE id = $1
       UNION ALL SELECT c.id, c.parent_id, up.depth + 1 FROM ref_categories c JOIN up ON c.id = up.parent_id WHERE up.depth < 10)
     SELECT id FROM up ORDER BY depth`, [categoryId]);
  return rows.map((row) => row.id);
}

/* ---------- Применимость ---------- */

export type Fitment = { id: number; make: string; model: string; generation: string; yearFrom: number | null; yearTo: number | null; engine: string; verified: boolean; verifiedBy: string; note: string };

export async function fitmentsOf(productId: string): Promise<Fitment[]> {
  return (await many<Row>("SELECT * FROM part_fitments WHERE product_id = $1 ORDER BY verified DESC, make, model, generation", [productId])).map((row) => ({
    id: Number(row.id), make: String(row.make), model: String(row.model), generation: String(row.generation),
    yearFrom: row.year_from === null ? null : Number(row.year_from), yearTo: row.year_to === null ? null : Number(row.year_to),
    engine: String(row.engine), verified: Boolean(row.verified), verifiedBy: String(row.verified_by), note: String(row.note),
  }));
}

const field = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().slice(0, limit) : "");
const year = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1950 || number > new Date().getFullYear() + 1) throw new Error("Проверьте год.");
  return number;
};

export async function addFitment(actor: Staff, productId: string, input: Record<string, unknown>) {
  const make = field(input.make, 60);
  if (make.length < 2) throw new Error("Укажите марку.");
  if (!(await one("SELECT id FROM catalog_products WHERE id = $1", [productId]))) throw new Error("Деталь не найдена.");
  const verified = input.verified === true || input.verified === "on";
  const from = year(input.yearFrom), to = year(input.yearTo);
  if (from && to && from > to) throw new Error("Год «с» позже года «по».");
  await run(
    "INSERT INTO part_fitments (product_id, make, model, generation, year_from, year_to, engine, verified, verified_by, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [productId, make, field(input.model, 60), field(input.generation, 40), from, to, field(input.engine, 60), verified, verified ? actor.name : "", field(input.note, 200)]);
  await audit(actor, "Применимость детали", `${productId}: ${make} ${field(input.model, 60)} ${field(input.generation, 40)}${verified ? " (проверено)" : ""}`);
}

export async function removeFitment(actor: Staff, id: number) {
  const row = await one<{ product_id: string }>("DELETE FROM part_fitments WHERE id = $1 RETURNING product_id", [id]);
  if (!row) throw new Error("Запись не найдена.");
  await audit(actor, "Применимость удалена", `${row.product_id}: № ${id}`);
}

/* ---------- Сопутствующие категории ---------- */

export async function relatedCategories(categoryIds: string[]): Promise<{ id: string; slug: string; name: string; parentSlug: string | null }[]> {
  if (!categoryIds.length) return [];
  return many(
    `SELECT DISTINCT ON (c.id) c.id, c.slug, c.name_ru AS name, p.slug AS "parentSlug", r.sort_order
     FROM ref_related_categories r JOIN ref_categories c ON c.id = r.related_id LEFT JOIN ref_categories p ON p.id = c.parent_id
     WHERE r.category_id = ANY($1::text[]) AND c.visible = 1 ORDER BY c.id, r.sort_order`, [categoryIds]);
}

/** Категория и все вложенные: список раздела показывает и детали подразделов, как и его счётчик. */
export async function categoryTree(categoryId: string): Promise<string[]> {
  const rows = await many<{ id: string }>(
    `WITH RECURSIVE down AS (SELECT id, 0 AS depth FROM ref_categories WHERE id = $1
       UNION ALL SELECT c.id, down.depth + 1 FROM ref_categories c JOIN down ON c.parent_id = down.id WHERE down.depth < 10)
     SELECT id FROM down`, [categoryId]);
  return rows.map((row) => row.id);
}

/**
 * Характеристики детали по шаблону.
 *
 * Шаблон лежит в ref_attr_templates: ключ, подпись RU/RO, тип (число, список, текст, да/нет),
 * единица, варианты, фильтруемость, порядок. Из одного шаблона собираются:
 *  - поля формы в админке (AttributeFields),
 *  - таблица на карточке (formatAttrs),
 *  - фильтры со счётчиками (attrFacets в catalog-listing),
 *  - подсказка названия (nameHint).
 *
 * Все характеристики необязательные: карточка без них работает.
 * Этот файл без server-only — его же читает форма в браузере.
 */

export type AttrKind = "number" | "list" | "text" | "bool";

export type AttrTemplate = {
  id: string;
  categoryId: string | null;
  partTypeId: string | null;
  key: string;
  labelRu: string;
  labelRo: string;
  kind: AttrKind;
  unit: string;
  options: string[];
  filterable: boolean;
  inName: boolean;
  sortOrder: number;
};

export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue>;

/**
 * Шаблон для конкретной детали: общие поля, поля её категории и всех категорий выше,
 * поля её типа. Один ключ берётся из самого узкого места: тип главнее категории, категория — общего.
 */
export function templatesFor(all: AttrTemplate[], categoryPath: string[], partTypeId: string | null): AttrTemplate[] {
  const picked = new Map<string, { template: AttrTemplate; rank: number }>();
  for (const template of all) {
    let rank = -1;
    if (template.partTypeId) rank = template.partTypeId === partTypeId ? 100 : -1;
    else if (template.categoryId) { const depth = categoryPath.indexOf(template.categoryId); rank = depth === -1 ? -1 : 10 + depth; }
    else rank = 0;
    if (rank < 0) continue;
    const current = picked.get(template.key);
    if (!current || current.rank < rank) picked.set(template.key, { template, rank });
  }
  return [...picked.values()].map(({ template }) => template)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.labelRu.localeCompare(right.labelRu, "ru"));
}

export class AttrError extends Error {}

/**
 * Проверка на сервере. Неизвестные ключи отбрасываются, пустое значение — удаляет ключ.
 * Значения вне шаблона, которые уже лежат у детали, сохраняются: правка не теряет старые данные.
 */
export function cleanAttrs(input: unknown, templates: AttrTemplate[], previous: Attrs = {}): Attrs {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const result: Attrs = { ...previous };
  for (const template of templates) {
    if (!(template.key in source)) continue;
    const raw = source[template.key];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) { delete result[template.key]; continue; }
    if (template.kind === "number") {
      const number = typeof raw === "number" ? raw : Number(String(raw).replace(",", ".").trim());
      if (!Number.isFinite(number) || number < 0 || number > 1_000_000) throw new AttrError(`Проверьте поле «${template.labelRu}»: нужно число.`);
      result[template.key] = Math.round(number * 1000) / 1000;
    } else if (template.kind === "bool") {
      if (raw === true || raw === "true" || raw === "on" || raw === "1") result[template.key] = true;
      else if (raw === false || raw === "false" || raw === "0") result[template.key] = false;
      else throw new AttrError(`Проверьте поле «${template.labelRu}»: да или нет.`);
    } else if (template.kind === "list") {
      const value = String(raw).trim();
      if (!template.options.includes(value)) throw new AttrError(`Поле «${template.labelRu}»: выберите вариант из списка.`);
      result[template.key] = value;
    } else {
      const value = String(raw).trim();
      if (value.length > 160) throw new AttrError(`Поле «${template.labelRu}» длиннее 160 символов.`);
      result[template.key] = value;
    }
  }
  return result;
}

export function formatValue(template: Pick<AttrTemplate, "kind" | "unit">, value: AttrValue): string {
  if (template.kind === "bool") return value === true ? "да" : "нет";
  const text = typeof value === "number" ? value.toLocaleString("ru-RU") : String(value);
  return template.unit ? `${text} ${template.unit}` : text;
}

/** Строки для таблицы на карточке: в порядке шаблона, только заполненные. */
export function formatAttrs(templates: AttrTemplate[], attrs: Attrs): { key: string; label: string; value: string }[] {
  return templates
    .filter((template) => attrs[template.key] !== undefined && attrs[template.key] !== "")
    .map((template) => ({ key: template.key, label: template.labelRu, value: formatValue(template, attrs[template.key]!) }));
}

/** Подсказка названия: тип + отмеченные «в название» характеристики. Например «Тормозной диск 320 мм вентилируемый». */
export function nameHint(base: string, templates: AttrTemplate[], attrs: Attrs): string {
  const parts = templates.filter((template) => template.inName && attrs[template.key] !== undefined && attrs[template.key] !== "" && attrs[template.key] !== false)
    .map((template) => template.kind === "bool" ? template.labelRu.toLowerCase() : formatValue(template, attrs[template.key]!));
  return [base, ...parts].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export type CrossNumber = { number: string; source: string };

/** Кросс-номера: «Brembo: P 50 011; Bosch: 0986494071» → список с источником. Источник необязателен. */
export function cleanCrossNumbers(input: unknown): CrossNumber[] {
  const list: CrossNumber[] = [];
  const push = (number: unknown, source: unknown) => {
    const value = String(number ?? "").trim().slice(0, 40);
    if (!value) return;
    if (!/^[\p{L}\p{N} .\-/]+$/u.test(value)) throw new AttrError("Кросс-номер: только буквы, цифры, пробел, точка, дефис и косая черта.");
    list.push({ number: value, source: String(source ?? "").trim().slice(0, 40) });
  };
  if (Array.isArray(input)) for (const item of input) { const row = item as Partial<CrossNumber>; push(row?.number, row?.source); }
  else if (typeof input === "string") for (const line of input.split(/[;\n]/)) { const index = line.indexOf(":"); if (index === -1) push(line, ""); else push(line.slice(index + 1), line.slice(0, index)); }
  if (list.length > 30) throw new AttrError("Не больше 30 кросс-номеров.");
  return list;
}

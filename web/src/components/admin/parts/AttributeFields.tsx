"use client";
// Поля характеристик собираются из шаблона категории в браузере: при смене типа детали форма меняется сразу.

import { templatesFor, type AttrTemplate, type Attrs } from "@/lib/attributes";

export type CategoryRef = { id: string; parentId: string | null };

/** Путь категории вверх до основной: из него берутся поля шаблона. */
export function pathOf(categories: CategoryRef[], id: string | null): string[] {
  const path: string[] = [];
  let current = id;
  for (let guard = 0; current && guard < 10; guard += 1) {
    path.push(current);
    current = categories.find((item) => item.id === current)?.parentId ?? null;
  }
  return path;
}

export function fieldsFor(all: AttrTemplate[], categories: CategoryRef[], categoryId: string | null, partTypeId: string | null) {
  return templatesFor(all, pathOf(categories, categoryId), partTypeId);
}

/** Значения формы: строка для текста и чисел, «true/false» для да/нет, пусто — не заполнено. */
export type AttrDraft = Record<string, string>;

export function draftFrom(attrs: Attrs): AttrDraft {
  return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
}

export function AttributeFields({ templates, value, onChange }: { templates: AttrTemplate[]; value: AttrDraft; onChange: (next: AttrDraft) => void }) {
  const set = (key: string, next: string) => onChange({ ...value, [key]: next });
  if (!templates.length) return null;
  return <div className="admin-form-grid" data-attr-fields>
    {templates.map((template) => {
      const label = `${template.labelRu}${template.unit ? `, ${template.unit}` : ""}`;
      const current = value[template.key] ?? "";
      if (template.kind === "bool") return <label className="admin-field" key={template.key}>{label}
        <select name={`attr_${template.key}`} onChange={(event) => set(template.key, event.target.value)} value={current}>
          <option value="">не указано</option><option value="true">да</option><option value="false">нет</option>
        </select>
      </label>;
      if (template.kind === "list") return <label className="admin-field" key={template.key}>{label}
        <select name={`attr_${template.key}`} onChange={(event) => set(template.key, event.target.value)} value={current}>
          <option value="">не указано</option>
          {template.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>;
      return <label className="admin-field" key={template.key}>{label}
        <input inputMode={template.kind === "number" ? "decimal" : undefined} name={`attr_${template.key}`} onChange={(event) => set(template.key, event.target.value)} value={current} />
      </label>;
    })}
  </div>;
}

/** Кросс-номера строкой: «Brembo: P 50 011; Bosch: 0986494071» — источник, двоеточие, номер. */
export function crossToText(list: { number: string; source: string }[]) {
  return list.map((item) => (item.source ? `${item.source}: ${item.number}` : item.number)).join("; ");
}

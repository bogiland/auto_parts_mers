"use client";
// Справочник редактируется прямо в списке: состояние форм и карточка правки живут в браузере.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash, X } from "lucide-react";
import type { CategoryNode, PartType } from "@/lib/reference-db";
import { referenceAction } from "./reference-client";

type Draft = Omit<PartType, "id"> & { id: string | null };

function sample(draft: Draft) {
  return [draft.nameRu || "Название", draft.hasSide ? "левая" : "", draft.hasPosition ? "передняя" : ""].filter(Boolean).join(" ");
}

export function PartTypes({ types, categories }: { types: PartType[]; categories: CategoryNode[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quick, setQuick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await referenceAction(body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  const categoryName = (id: string | null) => categories.find((node) => node.id === id)?.nameRu ?? "Без категории";

  return <section className="admin-card">
    <div className="admin-row"><div><h2>Типы деталей</h2><p className="admin-muted">Из этого справочника собирается название детали при добавлении на склад.</p></div></div>
    <form className="admin-quick-add" onSubmit={async (event) => { event.preventDefault(); if (await run({ action: "save-part-type", nameRu: quick }, `Тип «${quick.trim()}» добавлен`)) setQuick(""); }}>
      <input onChange={(event) => setQuick(event.target.value)} placeholder="Новый тип, например «Фара»" value={quick} />
      <button className="admin-button" disabled={busy || quick.trim().length < 2} type="submit"><Plus size={16} />Добавить</button>
    </form>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !draft && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-list">
      {types.map((type) => <div className="admin-card admin-row admin-sub-card" key={type.id}>
        <div className="admin-tree-name">
          <strong>{type.nameRu}</strong>
          <small className="admin-muted">{categoryName(type.categoryId)}{type.nameRo ? ` · RO: ${type.nameRo}` : ""}</small>
        </div>
        <div className="admin-chip-row">
          {type.hasSide && <span className="admin-chip">сторона</span>}
          {type.hasPosition && <span className="admin-chip">положение</span>}
          {type.assembly && <span className="admin-chip">бывает в сборе</span>}
          {type.returnRestricted && <span className="admin-chip" data-status="received">возврату не подлежит</span>}
        </div>
        <div className="admin-tree-actions">
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setDraft({ ...type }); setError(""); }} type="button"><Pencil size={16} /></button>
          <button aria-label="Удалить" className="admin-icon-button" disabled={busy} onClick={() => { if (window.confirm(`Удалить тип «${type.nameRu}»?`)) void run({ action: "delete-part-type", id: type.id }, "Тип удалён"); }} type="button"><Trash size={16} /></button>
        </div>
      </div>)}
      {!types.length && <p className="admin-muted">Типов пока нет. Начните с тех, что встречаются чаще всего: «Фара», «Дверь», «Двигатель», «КПП».</p>}
    </div>

    {draft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section aria-label="Тип детали" className="admin-detail" role="dialog">
        <header><h2>{draft.id ? "Тип детали" : "Новый тип детали"}</h2><button aria-label="Закрыть" onClick={() => setDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Название RU<input onChange={(event) => setDraft({ ...draft, nameRu: event.target.value })} value={draft.nameRu} /></label>
          <label className="admin-field">Название RO<input onChange={(event) => setDraft({ ...draft, nameRo: event.target.value })} value={draft.nameRo} /></label>
          <label className="admin-field">Категория по умолчанию
            <select onChange={(event) => setDraft({ ...draft, categoryId: event.target.value || null })} value={draft.categoryId ?? ""}>
              <option value="">Не выбрана</option>
              {categories.map((node) => <option key={node.id} value={node.id}>{"— ".repeat(node.depth - 1)}{node.nameRu}</option>)}
            </select>
          </label>
          <label className="admin-field admin-field-check"><input checked={draft.hasSide} onChange={(event) => setDraft({ ...draft, hasSide: event.target.checked })} type="checkbox" /><span>Есть сторона: левая / правая</span></label>
          <label className="admin-field admin-field-check"><input checked={draft.hasPosition} onChange={(event) => setDraft({ ...draft, hasPosition: event.target.checked })} type="checkbox" /><span>Есть положение: перед / зад</span></label>
          <label className="admin-field admin-field-check"><input checked={draft.assembly} onChange={(event) => setDraft({ ...draft, assembly: event.target.checked })} type="checkbox" /><span>Бывает в сборе</span></label>
          {draft.assembly && <label className="admin-field admin-field-wide">Что входит в сборку<textarea onChange={(event) => setDraft({ ...draft, assemblyIncludes: event.target.value })} placeholder="Например: двигатель с навесным, стартер, генератор" rows={2} value={draft.assemblyIncludes} /></label>}
          <label className="admin-field admin-field-check"><input checked={draft.returnRestricted} onChange={(event) => setDraft({ ...draft, returnRestricted: event.target.checked })} type="checkbox" /><span>Возврату не подлежит — для двигателей, КПП и других агрегатов</span></label>
        </div>
        <p className="admin-note">Название детали получится такое: <strong>{sample(draft)}</strong></p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions">
          <button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-part-type", ...draft }, "Тип сохранён")) setDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button>
          <button className="admin-ghost-button" onClick={() => setDraft(null)} type="button">Отмена</button>
        </div>
      </section>
    </div>}
  </section>;
}

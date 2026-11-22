"use client";
// Форма бренда и загрузка логотипа работают в браузере.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash, X } from "lucide-react";
import { SingleImageField } from "@/components/admin/ImagePicker";
import type { PartBrand } from "@/lib/reference-db";
import { referenceAction } from "./reference-client";

type Draft = { id: string | null; name: string; logo: string; description: string };

export function Brands({ brands }: { brands: PartBrand[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await referenceAction(body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-row"><div><h2>Бренды</h2><p className="admin-muted">Производители новых расходников: Bosch, Mann и прочие. К б/у деталям с доноров отношения не имеют.</p></div><button className="admin-button" onClick={() => { setDraft({ id: null, name: "", logo: "", description: "" }); setError(""); }} type="button"><Plus size={16} />Бренд</button></div>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !draft && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-list">
      {brands.map((brand) => <div className="admin-card admin-row admin-sub-card" key={brand.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {brand.logo ? <img alt="" className="admin-brand-logo" src={brand.logo} /> : <span className="admin-tree-spacer" />}
        <div className="admin-tree-name"><strong>{brand.name}</strong>{brand.description && <small className="admin-muted">{brand.description}</small>}</div>
        <div className="admin-tree-actions">
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setDraft({ ...brand }); setError(""); }} type="button"><Pencil size={16} /></button>
          <button aria-label="Удалить" className="admin-icon-button" disabled={busy} onClick={async () => { if (window.confirm(`Удалить бренд «${brand.name}»?`)) void (await run({ action: "delete-brand", id: brand.id }, "Бренд удалён")); }} type="button"><Trash size={16} /></button>
        </div>
      </div>)}
      {!brands.length && <p className="admin-muted">Брендов пока нет.</p>}
    </div>

    {draft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section aria-label="Бренд" className="admin-detail" role="dialog">
        <header><h2>{draft.id ? "Бренд" : "Новый бренд"}</h2><button aria-label="Закрыть" onClick={() => setDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Название<input onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Bosch" value={draft.name} /></label>
          <label className="admin-field admin-field-wide">Короткое описание<textarea onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} value={draft.description} /></label>
        </div>
        <SingleImageField label="Логотип бренда" onChange={(next) => setDraft({ ...draft, logo: next })} preset="brand-logo" value={draft.logo} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions"><button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-brand", ...draft }, "Бренд сохранён")) setDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button><button className="admin-ghost-button" onClick={() => setDraft(null)} type="button">Отмена</button></div>
      </section>
    </div>}
  </section>;
}

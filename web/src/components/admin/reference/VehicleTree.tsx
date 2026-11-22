"use client";
// Раскрытие веток, встроенные формы и загрузка логотипа работают в браузере.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash, X } from "lucide-react";
import { SingleImageField } from "@/components/admin/ImagePicker";
import type { VehicleMake, VehicleModel } from "@/lib/reference-db";
import { referenceAction } from "./reference-client";

type MakeDraft = { id: string | null; name: string; logo: string };
type ModelDraft = { id: string | null; makeId: string; name: string };
type GenerationDraft = { id: string | null; modelId: string; name: string; yearFrom: string; yearTo: string; engines: string };

export function VehicleTree({ makes }: { makes: VehicleMake[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string[]>([]);
  const [makeDraft, setMakeDraft] = useState<MakeDraft | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelDraft | null>(null);
  const [generationDraft, setGenerationDraft] = useState<GenerationDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const toggle = (id: string) => setOpen((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await referenceAction(body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  const years = (model: VehicleModel) => model.generations.length ? `${model.generations.length} поколен.` : "поколения не заведены";

  return <section className="admin-card">
    <div className="admin-row"><div><h2>Марки и модели</h2><p className="admin-muted">Отсюда работает подбор по машине на сайте и страницы вида «Запчасти Mercedes W212».</p></div><button className="admin-button" onClick={() => { setMakeDraft({ id: null, name: "", logo: "" }); setError(""); }} type="button"><Plus size={16} />Марка</button></div>
    <p className="admin-note">Количество деталей считается по привязке детали к модели. Счётчик доноров появится вместе с разделом «Доноры» — сейчас его не из чего считать.</p>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !makeDraft && !modelDraft && !generationDraft && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-tree">
      {makes.map((make) => <div className="admin-tree-branch" key={make.id}>
        <div className="admin-tree-row" data-depth={1}>
          <button aria-label={open.includes(make.id) ? "Свернуть" : "Развернуть"} className="admin-icon-button" onClick={() => toggle(make.id)} type="button">{open.includes(make.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {make.logo ? <img alt="" className="admin-tree-logo" src={make.logo} /> : <span className="admin-tree-spacer" />}
          <div className="admin-tree-name"><strong>{make.name}</strong><small className="admin-muted">{make.models.length} модел. · {make.parts} дет. · доноры: —</small></div>
          <div className="admin-tree-actions">
            <button className="admin-ghost-button" onClick={() => { setModelDraft({ id: null, makeId: make.id, name: "" }); setError(""); }} type="button"><Plus size={14} />Модель</button>
            <button aria-label="Изменить марку" className="admin-icon-button" onClick={() => { setMakeDraft({ id: make.id, name: make.name, logo: make.logo }); setError(""); }} type="button"><Pencil size={16} /></button>
            <button aria-label="Удалить марку" className="admin-icon-button" disabled={busy} onClick={async () => { if (window.confirm(`Удалить марку «${make.name}»?`)) void (await run({ action: "delete-vehicle", level: "make", id: make.id }, "Марка удалена")); }} type="button"><Trash size={16} /></button>
          </div>
        </div>
        {open.includes(make.id) && <div className="admin-tree-children">
          {make.models.map((model) => <div className="admin-tree-branch" key={model.id}>
            <div className="admin-tree-row" data-depth={2}>
              <button aria-label={open.includes(model.id) ? "Свернуть" : "Развернуть"} className="admin-icon-button" onClick={() => toggle(model.id)} type="button">{open.includes(model.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
              <div className="admin-tree-name"><strong>{model.name}</strong><small className="admin-muted">{years(model)} · {model.parts} дет.</small></div>
              <div className="admin-tree-actions">
                <button className="admin-ghost-button" onClick={() => { setGenerationDraft({ id: null, modelId: model.id, name: "", yearFrom: "", yearTo: "", engines: "" }); setError(""); }} type="button"><Plus size={14} />Поколение</button>
                <button aria-label="Изменить модель" className="admin-icon-button" onClick={() => { setModelDraft({ id: model.id, makeId: make.id, name: model.name }); setError(""); }} type="button"><Pencil size={16} /></button>
                <button aria-label="Удалить модель" className="admin-icon-button" disabled={busy} onClick={async () => { if (window.confirm(`Удалить модель «${model.name}»?`)) void (await run({ action: "delete-vehicle", level: "model", id: model.id }, "Модель удалена")); }} type="button"><Trash size={16} /></button>
              </div>
            </div>
            {open.includes(model.id) && <div className="admin-tree-children">
              {model.generations.map((generation) => <div className="admin-tree-row" data-depth={3} key={generation.id}>
                <span className="admin-tree-spacer" />
                <div className="admin-tree-name"><strong>{generation.name}</strong><small className="admin-muted">{generation.yearFrom ?? "?"}–{generation.yearTo ?? "наст. время"}{generation.engines ? ` · ${generation.engines}` : ""}</small></div>
                <div className="admin-tree-actions">
                  <button aria-label="Изменить поколение" className="admin-icon-button" onClick={() => { setGenerationDraft({ id: generation.id, modelId: model.id, name: generation.name, yearFrom: generation.yearFrom ? String(generation.yearFrom) : "", yearTo: generation.yearTo ? String(generation.yearTo) : "", engines: generation.engines }); setError(""); }} type="button"><Pencil size={16} /></button>
                  <button aria-label="Удалить поколение" className="admin-icon-button" disabled={busy} onClick={async () => { if (window.confirm(`Удалить поколение «${generation.name}»?`)) void (await run({ action: "delete-vehicle", level: "generation", id: generation.id }, "Поколение удалено")); }} type="button"><Trash size={16} /></button>
                </div>
              </div>)}
              {!model.generations.length && <p className="admin-muted">Поколения не заведены.</p>}
            </div>}
          </div>)}
          {!make.models.length && <p className="admin-muted">Моделей пока нет.</p>}
        </div>}
      </div>)}
      {!makes.length && <p className="admin-muted">Марок пока нет. Заведите те, что чаще всего приходят на разборку.</p>}
    </div>

    {makeDraft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMakeDraft(null); }}>
      <section aria-label="Марка" className="admin-detail" role="dialog">
        <header><h2>{makeDraft.id ? "Марка" : "Новая марка"}</h2><button aria-label="Закрыть" onClick={() => setMakeDraft(null)} type="button"><X size={22} /></button></header>
        <label className="admin-field">Название<input onChange={(event) => setMakeDraft({ ...makeDraft, name: event.target.value })} placeholder="Mercedes-Benz" value={makeDraft.name} /></label>
        <SingleImageField label="Логотип марки" onChange={(next) => setMakeDraft({ ...makeDraft, logo: next })} preset="make-logo" value={makeDraft.logo} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions"><button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-make", ...makeDraft }, "Марка сохранена")) setMakeDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button><button className="admin-ghost-button" onClick={() => setMakeDraft(null)} type="button">Отмена</button></div>
      </section>
    </div>}

    {modelDraft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModelDraft(null); }}>
      <section aria-label="Модель" className="admin-detail" role="dialog">
        <header><h2>{modelDraft.id ? "Модель" : "Новая модель"}</h2><button aria-label="Закрыть" onClick={() => setModelDraft(null)} type="button"><X size={22} /></button></header>
        <label className="admin-field">Название<input onChange={(event) => setModelDraft({ ...modelDraft, name: event.target.value })} placeholder="E-Class W212" value={modelDraft.name} /></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions"><button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-model", ...modelDraft }, "Модель сохранена")) setModelDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button><button className="admin-ghost-button" onClick={() => setModelDraft(null)} type="button">Отмена</button></div>
      </section>
    </div>}

    {generationDraft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGenerationDraft(null); }}>
      <section aria-label="Поколение" className="admin-detail" role="dialog">
        <header><h2>{generationDraft.id ? "Поколение" : "Новое поколение"}</h2><button aria-label="Закрыть" onClick={() => setGenerationDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Название<input onChange={(event) => setGenerationDraft({ ...generationDraft, name: event.target.value })} placeholder="W212 рестайлинг" value={generationDraft.name} /></label>
          <label className="admin-field">Год начала<input max={2100} min={1950} onChange={(event) => setGenerationDraft({ ...generationDraft, yearFrom: event.target.value })} type="number" value={generationDraft.yearFrom} /></label>
          <label className="admin-field">Год окончания<input max={2100} min={1950} onChange={(event) => setGenerationDraft({ ...generationDraft, yearTo: event.target.value })} placeholder="пусто — выпускается" type="number" value={generationDraft.yearTo} /></label>
          <label className="admin-field admin-field-wide">Двигатели<input onChange={(event) => setGenerationDraft({ ...generationDraft, engines: event.target.value })} placeholder="OM651 2.2d, M274 2.0" value={generationDraft.engines} /></label>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions"><button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-generation", ...generationDraft }, "Поколение сохранено")) setGenerationDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button><button className="admin-ghost-button" onClick={() => setGenerationDraft(null)} type="button">Отмена</button></div>
      </section>
    </div>}
  </section>;
}

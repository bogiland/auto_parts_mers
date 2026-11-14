"use client";
// Доноры: машины, с которых снимают детали. У каждой своя страница на сайте со списком доступных деталей.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Trash, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { staffCall, when } from "@/components/admin/staff-client";
import type { VehicleMake } from "@/lib/reference-db";

type Photo = { src: string; closeup: boolean; preview?: string };
type Donor = {
  id: string; makeId: string | null; modelId: string | null; generationId: string | null;
  make: string; model: string; generation: string; year: number | null; engine: string; mileage: number | null;
  note: string; photos: Photo[]; visible: boolean; parts: number; createdAt: string;
};
type Draft = Omit<Donor, "year" | "mileage" | "parts" | "createdAt"> & { year: string; mileage: string };

const label = (donor: { make: string; model: string; generation: string; year: number | null }) =>
  [donor.make, donor.model, donor.generation, donor.year ? String(donor.year) : ""].filter(Boolean).join(" ");

const empty: Draft = { id: "", makeId: null, modelId: null, generationId: null, make: "", model: "", generation: "", year: "", engine: "", mileage: "", note: "", photos: [], visible: true };

export function DonorsBoard({ donors, makes }: { donors: Donor[]; makes: VehicleMake[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const text = query.trim().toLowerCase();
  const visible = donors.filter((donor) => !text || `${label(donor)} ${donor.engine}`.toLowerCase().includes(text));

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await staffCall("parts", body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-row">
      <div>
        <h2>Машины-доноры</h2>
        <p className="admin-muted">Машина заводится за двадцать секунд: марка, модель, год и двигатель. Фото и пробег можно добавить потом.</p>
      </div>
      <button className="admin-button" onClick={() => { setDraft({ ...empty }); setError(""); }} type="button"><Plus size={16} />Донор</button>
    </div>
    <div className="admin-table-tools"><input aria-label="Поиск по машинам" onChange={(event) => setQuery(event.target.value)} placeholder="Марка, модель или двигатель" value={query} /></div>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !draft && <p className="admin-error" role="alert">{error}</p>}

    <div className="admin-list">
      {visible.map((donor) => <div className="admin-card admin-row admin-sub-card" key={donor.id}>
        <span className="admin-part-photo">
          {donor.photos.length
            // eslint-disable-next-line @next/next/no-img-element
            ? <img alt="" src={donor.photos[0].preview || donor.photos[0].src} />
            : <span className="admin-part-nophoto">нет фото</span>}
        </span>
        <div className="admin-tree-name">
          <strong>{label(donor)}</strong>
          <small className="admin-muted">{[donor.engine, donor.mileage === null ? "" : `${donor.mileage.toLocaleString("ru-RU")} км`, `деталей: ${donor.parts}`, `заведён ${when(donor.createdAt)}`].filter(Boolean).join(" · ")}</small>
        </div>
        {!donor.visible && <span className="admin-chip" data-status="closed">скрыт</span>}
        <div className="admin-tree-actions">
          {donor.visible && <Link aria-label="Открыть страницу машины" className="admin-icon-button" href={`/donors/${donor.id}`} target="_blank"><ExternalLink size={16} /></Link>}
          <button aria-label={donor.visible ? "Скрыть" : "Показать"} className="admin-icon-button" disabled={busy} onClick={() => void run({ action: "save-donor", ...donor, year: donor.year ?? "", mileage: donor.mileage ?? "", visible: !donor.visible, photos: donor.photos }, donor.visible ? "Машина скрыта" : "Машина снова на сайте")} type="button">{donor.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setDraft({ ...donor, year: donor.year === null ? "" : String(donor.year), mileage: donor.mileage === null ? "" : String(donor.mileage) }); setError(""); }} type="button"><Pencil size={16} /></button>
        </div>
      </div>)}
      {!visible.length && <p className="admin-muted">{text ? "Ничего не найдено" : "Машин пока нет."}</p>}
    </div>

    {draft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section aria-label="Машина-донор" className="admin-detail" role="dialog">
        <header><h2>{draft.id ? label({ ...draft, year: draft.year ? Number(draft.year) : null }) : "Новая машина"}</h2><button aria-label="Закрыть" onClick={() => setDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Марка<input list="donor-makes" onChange={(event) => setDraft({ ...draft, make: event.target.value })} value={draft.make} /></label>
          <label className="admin-field">Модель<input onChange={(event) => setDraft({ ...draft, model: event.target.value })} value={draft.model} /></label>
          <label className="admin-field">Поколение<input onChange={(event) => setDraft({ ...draft, generation: event.target.value })} placeholder="W212" value={draft.generation} /></label>
          <label className="admin-field">Год<input max={new Date().getFullYear() + 1} min="1950" onChange={(event) => setDraft({ ...draft, year: event.target.value })} type="number" value={draft.year} /></label>
          <label className="admin-field">Двигатель<input onChange={(event) => setDraft({ ...draft, engine: event.target.value })} placeholder="OM651 2.1 дизель" value={draft.engine} /></label>
          <label className="admin-field">Пробег, км<input min="0" onChange={(event) => setDraft({ ...draft, mileage: event.target.value })} type="number" value={draft.mileage} /></label>
          <label className="admin-field admin-field-wide">Заметка для страницы машины<textarea onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={2} value={draft.note} /></label>
          <label className="admin-field admin-field-check"><input checked={draft.visible} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} type="checkbox" />Показывать страницу машины на сайте</label>
        </div>
        <datalist id="donor-makes">{makes.map((make) => <option key={make.id} value={make.name} />)}</datalist>
        {draft.photos.length > 0 && <div className="admin-gallery-grid">{draft.photos.map((photo, index) => <figure className="admin-gallery-item" key={photo.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.preview || photo.src} />
          <figcaption><button aria-label="Удалить фото" className="admin-icon-button" onClick={() => setDraft({ ...draft, photos: draft.photos.filter((_, position) => position !== index) })} type="button"><Trash size={14} /></button></figcaption>
        </figure>)}</div>}
        {draft.photos.length < 8 && <ImagePicker label="Фото машины" onChange={(next) => { const src = next.donor; if (src) setDraft({ ...draft, photos: [...draft.photos, { src, closeup: false, preview: next.preview ?? "" }] }); }} presets={["donor"]} previewPreset="part-preview" value={{}} />}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions">
          <button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-donor", ...draft }, "Машина сохранена")) setDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button>
          <button className="admin-ghost-button" onClick={() => setDraft(null)} type="button">Отмена</button>
        </div>
      </section>
    </div>}
  </section>;
}

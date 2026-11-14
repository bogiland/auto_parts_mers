"use client";
// Список деталей: быстрые действия прямо в строке и фильтры на то, что чаще всего забывают заполнить.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, History, Minus, Pencil, Trash, Undo2, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { money, staffCall, when } from "@/components/admin/staff-client";
import { AddPartWizard } from "./AddPartWizard";
import type { PartType, VehicleMake } from "@/lib/reference-db";

type Photo = { src: string; closeup: boolean; preview?: string };
type Part = {
  id: string; sku: string; nameRu: string; nameRo: string; priceMdl: number | null; priceMode: string; stock: number;
  condition: string; location: string; donorId: string | null; donorTitle: string; categoryId: string | null;
  includes: string; applicability: string; photos: Photo[]; returnRestricted: boolean; hidden: boolean;
  soldAt: string | null; createdAt: string;
};
type Move = { id: number; delta: number; reason: string; orderId: number | null; actor: string; at: string; canUndo: boolean };
type Category = { id: string; nameRu: string; depth: number };
type Donor = { id: string; make: string; model: string; generation: string; year: number | null; engine: string; mileage: number | null; parts: number };

const conditions = [
  { id: "new", label: "Новая" },
  { id: "good", label: "Б/у, хорошее" },
  { id: "defect", label: "С дефектом" },
  { id: "parts", label: "На запчасти" },
];
const conditionLabel = (id: string) => conditions.find((item) => item.id === id)?.label ?? "не указано";
const reasons: Record<string, string> = {
  order_confirm: "Списано по заказу", order_cancel: "Возвращено при отмене", order_return: "Возвращено по возврату",
  offline_sale: "Продано офлайн", offline_undo: "Отмена офлайн-продажи", manual: "Правка вручную",
};
const filters = [
  { id: "all", label: "Все" },
  { id: "no_photo", label: "Нет фото" },
  { id: "no_price", label: "Нет цены" },
  { id: "no_ro", label: "Нет RO" },
  { id: "no_stock", label: "Остаток 0" },
  { id: "stale", label: "Давно не продавалась" },
] as const;

const staleBefore = Date.now() - 90 * 24 * 60 * 60 * 1000;

export function PartsBoard({ parts, types, categories, donors, makes, locations, typeUsage, openWizard = false }: {
  parts: Part[]; types: PartType[]; categories: Category[]; donors: Donor[]; makes: VehicleMake[];
  locations: string[]; typeUsage: Record<string, number>; openWizard?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [wizard, setWizard] = useState(openWizard);
  const [edit, setEdit] = useState<Part | null>(null);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const matches = (part: Part) => {
    if (filter === "no_photo") return !part.photos.length;
    if (filter === "no_price") return part.priceMode !== "fixed" || part.priceMdl === null;
    if (filter === "no_ro") return !part.nameRo;
    if (filter === "no_stock") return part.stock === 0;
    if (filter === "stale") return !part.soldAt || new Date(part.soldAt).getTime() < staleBefore;
    return true;
  };
  const text = query.trim().toLowerCase();
  const visible = parts.filter((part) => matches(part) && (!text || `${part.sku} ${part.nameRu} ${part.nameRo} ${part.donorTitle} ${part.location}`.toLowerCase().includes(text)));

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await staffCall("parts", body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  const count = (id: string) => (id === "all" ? parts.length : parts.filter((part) => {
    if (id === "no_photo") return !part.photos.length;
    if (id === "no_price") return part.priceMode !== "fixed" || part.priceMdl === null;
    if (id === "no_ro") return !part.nameRo;
    if (id === "no_stock") return part.stock === 0;
    if (id === "stale") return !part.soldAt || new Date(part.soldAt).getTime() < staleBefore;
    return true;
  }).length);

  return <>
    <div className="admin-row">
      <div className="admin-tabs">{filters.map((item) => <button className={filter === item.id ? "is-active" : ""} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label} <small>{count(item.id)}</small></button>)}</div>
      <button className="admin-button" onClick={() => setWizard(true)} type="button">+ Деталь по шагам</button>
    </div>
    <div className="admin-table-tools"><input aria-label="Поиск по деталям" onChange={(event) => setQuery(event.target.value)} placeholder="Артикул, название, машина или место" value={query} /></div>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !edit && <p className="admin-error" role="alert">{error}</p>}

    <div className="admin-list">
      {visible.map((part) => <div className="admin-card admin-part-row" key={part.id}>
        <span className="admin-part-photo">
          {part.photos.length
            // eslint-disable-next-line @next/next/no-img-element
            ? <img alt="" src={part.photos[0].preview || part.photos[0].src} />
            : <span className="admin-part-nophoto">нет фото</span>}
        </span>
        <span className="admin-part-main">
          <Link href={`/products/${part.id}`} target="_blank"><strong>{part.nameRu}</strong></Link>
          <small>{part.sku || "без артикула"}{part.donorTitle ? ` · ${part.donorTitle}` : ""} · {conditionLabel(part.condition)}{part.location ? ` · ${part.location}` : ""}</small>
        </span>
        <span className="admin-part-price">{part.priceMode === "fixed" && part.priceMdl !== null ? money(part.priceMdl) : "по запросу"}</span>
        <span className="admin-part-stock">{part.stock} шт.</span>
        <span className="admin-part-status">
          {part.hidden ? <span className="admin-chip" data-status="closed">скрыта</span> : part.stock === 0 ? <span className="admin-chip" data-status="received">нет в наличии</span> : <span className="admin-chip" data-status="issued">на сайте</span>}
        </span>
        <span className="admin-part-actions">
          <button aria-label="Продано офлайн, минус один" className="admin-icon-button" disabled={busy || part.stock < 1} onClick={() => void run({ action: "sell-offline", id: part.id }, "Списано: −1. Отменить можно в течение пяти минут.")} title="−1 продано офлайн" type="button"><Minus size={16} /></button>
          <button aria-label="История остатка" className="admin-icon-button" disabled={busy} onClick={async () => { const data = await staffCall<{ moves: Move[] }>("parts", { action: "stock-moves", id: part.id }); setMoves(data.moves); setEdit(part); }} type="button"><History size={16} /></button>
          <button aria-label={part.hidden ? "Показать на сайте" : "Скрыть с сайта"} className="admin-icon-button" disabled={busy} onClick={() => void run({ action: "part-hidden", id: part.id, hidden: !part.hidden }, part.hidden ? "Деталь снова на сайте" : "Деталь скрыта")} type="button">{part.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setEdit(part); setMoves(null); setError(""); }} type="button"><Pencil size={16} /></button>
        </span>
      </div>)}
      {!visible.length && <div className="admin-card admin-muted">{text || filter !== "all" ? "Ничего не найдено" : "Деталей пока нет. Нажмите «+ Деталь по шагам»."}</div>}
    </div>

    {wizard && <AddPartWizard categories={categories} donors={donors} locations={locations} makes={makes} onClose={() => setWizard(false)} typeUsage={typeUsage} types={types} />}
    {edit && <PartEditor categories={categories} error={error} moves={moves} onClose={() => { setEdit(null); setMoves(null); }} part={edit} run={run} />}
  </>;
}

function PartEditor({ part, categories, moves, error, run, onClose }: {
  part: Part; categories: Category[]; moves: Move[] | null; error: string;
  run: (body: Record<string, unknown>, success: string) => Promise<boolean>; onClose: () => void;
}) {
  const [nameRu, setNameRu] = useState(part.nameRu);
  const [nameRo, setNameRo] = useState(part.nameRo);
  const [condition, setCondition] = useState(part.condition || "good");
  const [price, setPrice] = useState(part.priceMdl === null ? "" : String(part.priceMdl));
  const [onRequest, setOnRequest] = useState(part.priceMode !== "fixed");
  const [stock, setStock] = useState(String(part.stock));
  const [location, setLocation] = useState(part.location);
  const [includes, setIncludes] = useState(part.includes);
  const [applicability, setApplicability] = useState(part.applicability);
  const [photos, setPhotos] = useState<Photo[]>(part.photos);
  const [dragged, setDragged] = useState<number | null>(null);

  async function savePhotos(next: Photo[]) {
    setPhotos(next);
    await run({ action: "part-photos", id: part.id, photos: next.map((photo) => ({ src: photo.src, closeup: photo.closeup, preview: photo.preview ?? "" })) }, "Фото сохранены");
  }

  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label={part.nameRu} className="admin-detail" role="dialog">
      <header><h2>{part.nameRu}</h2><button aria-label="Закрыть" onClick={onClose} type="button"><X size={22} /></button></header>
      <p className="admin-muted">Артикул {part.sku || "не выдан"} · адрес страницы не меняется после переименования{part.donorTitle ? ` · снято с ${part.donorTitle}` : ""}</p>
      {part.returnRestricted && <p className="admin-warning">Возврату не подлежит — это видно и в карточке заказа.</p>}

      <div className="admin-form-grid">
        <label className="admin-field admin-field-wide">Название, русский<input onChange={(event) => setNameRu(event.target.value)} value={nameRu} /></label>
        <label className="admin-field admin-field-wide">Название, румынский<input onChange={(event) => setNameRo(event.target.value)} value={nameRo} /></label>
        <label className="admin-field">Состояние<select onChange={(event) => setCondition(event.target.value)} value={condition}>{conditions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="admin-field">Цена, L.<input disabled={onRequest} min="0" onChange={(event) => setPrice(event.target.value)} type="number" value={price} /></label>
        <label className="admin-field admin-field-check"><input checked={onRequest} onChange={(event) => setOnRequest(event.target.checked)} type="checkbox" />Цена по запросу</label>
        <label className="admin-field">Остаток<input min="0" onChange={(event) => setStock(event.target.value)} type="number" value={stock} /></label>
        <label className="admin-field">Место на складе<input onChange={(event) => setLocation(event.target.value)} value={location} /></label>
        <label className="admin-field admin-field-wide">Применимость<input onChange={(event) => setApplicability(event.target.value)} value={applicability} /></label>
        <label className="admin-field admin-field-wide">Что входит в сборку<textarea onChange={(event) => setIncludes(event.target.value)} rows={2} value={includes} /></label>
        <p className="admin-note admin-field-wide">Категория каталога: {categories.find((item) => item.id === part.categoryId)?.nameRu ?? "без категории"}. Её меняют в карточке склада на вкладке «Детали» через справочник.</p>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-image-actions">
        <button className="admin-button" onClick={() => void run({ action: "update-part", id: part.id, nameRu, nameRo, condition, price, priceOnRequest: onRequest, stock, location, includes, applicability }, "Деталь сохранена")} type="button">Сохранить</button>
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Фото</h3>
        <p className="admin-muted">Перетащите, чтобы изменить порядок. Первое фото — обложка.</p>
        {photos.length > 0 && <div className="admin-gallery-grid">{photos.map((photo, index) => <figure
          className="admin-gallery-item"
          draggable
          key={photo.src}
          onDragEnd={() => setDragged(null)}
          onDragOver={(event) => event.preventDefault()}
          onDragStart={() => setDragged(index)}
          onDrop={() => {
            if (dragged === null || dragged === index) return;
            const next = [...photos];
            const [moved] = next.splice(dragged, 1);
            next.splice(index, 0, moved);
            void savePhotos(next);
            setDragged(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.preview || photo.src} />
          {index === 0 && <span className="admin-gallery-cover">Обложка</span>}
          <figcaption>
            <label><input checked={photo.closeup} onChange={(event) => void savePhotos(photos.map((item, position) => (position === index ? { ...item, closeup: event.target.checked } : item)))} type="checkbox" />крупный план</label>
            <button aria-label="Удалить фото" className="admin-icon-button" onClick={() => { if (window.confirm("Удалить это фото?")) void savePhotos(photos.filter((_, position) => position !== index)); }} type="button"><Trash size={14} /></button>
          </figcaption>
        </figure>)}</div>}
        {photos.length < 6 && <ImagePicker label="Добавить фото" onChange={(next) => { const src = next.part; if (src) void savePhotos([...photos, { src, closeup: false, preview: next.preview ?? "" }]); }} presets={["part"]} previewPreset="part-preview" value={{}} />}
      </div>

      {moves && <div className="admin-card admin-sub-card">
        <h3>История остатка</h3>
        <div className="admin-list">
          {moves.map((move) => <div className="admin-row" key={move.id}>
            <div className="admin-tree-name"><strong>{move.delta > 0 ? `+${move.delta}` : move.delta}</strong><small className="admin-muted">{reasons[move.reason] ?? move.reason}{move.orderId !== null ? ` · заказ № ${move.orderId + 1000}` : ""}</small></div>
            <span className="admin-muted">{move.actor} · {when(move.at)}</span>
            {move.canUndo && <button className="admin-ghost-button" onClick={() => void run({ action: "undo-move", id: move.id }, "Списание отменено")} type="button"><Undo2 size={14} />Отменить</button>}
          </div>)}
          {!moves.length && <p className="admin-muted">Остаток ещё не менялся.</p>}
        </div>
      </div>}
    </section>
  </div>;
}

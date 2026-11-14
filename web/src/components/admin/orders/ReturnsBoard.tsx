"use client";
// Возвраты: осмотр, фото, решение и сумма. Двигатели и агрегаты в сборе сюда не попадают — они не возвращаются.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { money, staffCall, when } from "@/components/admin/staff-client";

type Candidate = { id: number; number: number; name: string; status: string; items: { productId: string; name: string; quantity: number; unitPriceMdl: number; returnRestricted: boolean }[] };
type ReturnRow = { id: number; orderNumber: number; productName: string; inspection: string; decision: string; amountMdl: number; reason: string; actor: string; at: string; photos: { src: string }[] };

const decisions = [
  { id: "full", label: "Полный возврат" },
  { id: "partial", label: "Частичный возврат" },
  { id: "refused", label: "Отказ" },
];
const decisionLabel = (id: string) => decisions.find((item) => item.id === id)?.label ?? id;

export function ReturnsBoard({ rows, candidates }: { rows: ReturnRow[]; candidates: Candidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(candidates[0]?.id ?? null);
  const [productId, setProductId] = useState("");
  const [inspection, setInspection] = useState("");
  const [decision, setDecision] = useState("full");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const order = candidates.find((item) => item.id === orderId) ?? null;
  const items = order?.items.filter((item) => !item.returnRestricted) ?? [];
  const blocked = order?.items.filter((item) => item.returnRestricted) ?? [];
  const chosen = items.find((item) => item.productId === productId) ?? null;

  function reset() {
    setProductId(""); setInspection(""); setDecision("full"); setAmount("0"); setReason(""); setPhotos([]); setError("");
  }

  return <section className="admin-card">
    <div className="admin-row">
      <div>
        <h2>Возвраты</h2>
        <p className="admin-muted">Возврат оформляется по выданному заказу: осматриваем деталь, фотографируем, пишем решение и сумму. Двигатели, коробки и агрегаты в сборе возврату не подлежат.</p>
      </div>
      <button className="admin-button" disabled={!candidates.length} onClick={() => { setOpen(true); reset(); }} type="button"><Plus size={16} />Оформить возврат</button>
    </div>
    {!candidates.length && <p className="admin-note">Выданных заказов пока нет — возвращать нечего.</p>}

    <div className="admin-list">
      {rows.map((row) => <div className="admin-card admin-sub-card" key={row.id}>
        <div className="admin-row">
          <div className="admin-tree-name"><strong>Заказ № {row.orderNumber} · {row.productName}</strong><small className="admin-muted">{decisionLabel(row.decision)} · {money(row.amountMdl)}</small></div>
          <span className="admin-muted">{row.actor} · {when(row.at)}</span>
        </div>
        {row.inspection && <p className="admin-note">Осмотр: {row.inspection}</p>}
        <p className="admin-muted">Причина: {row.reason}</p>
        {row.photos.length > 0 && <div className="admin-gallery-grid">{row.photos.map((photo) => <figure className="admin-gallery-item" key={photo.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.src} />
        </figure>)}</div>}
      </div>)}
      {!rows.length && <p className="admin-muted">Возвратов пока не было.</p>}
    </div>

    {open && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section aria-label="Оформление возврата" className="admin-detail" role="dialog">
        <header><h2>Возврат</h2><button aria-label="Закрыть" onClick={() => setOpen(false)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Заказ<select onChange={(event) => { setOrderId(Number(event.target.value)); setProductId(""); }} value={orderId ?? ""}>{candidates.map((item) => <option key={item.id} value={item.id}>№ {item.number} · {item.name}</option>)}</select></label>
          <label className="admin-field">Деталь<select onChange={(event) => { setProductId(event.target.value); const item = items.find((row) => row.productId === event.target.value); setAmount(String(item ? item.unitPriceMdl * item.quantity : 0)); }} value={productId}>
            <option value="">Выберите деталь</option>
            {items.map((item) => <option key={item.productId} value={item.productId}>{item.name} — {money(item.unitPriceMdl * item.quantity)}</option>)}
          </select></label>
          {blocked.length > 0 && <p className="admin-warning admin-field-wide">В этом заказе есть агрегаты без возврата: {blocked.map((item) => item.name).join(", ")}. Их принять обратно нельзя.</p>}
          <label className="admin-field admin-field-wide">Что показал осмотр<textarea onChange={(event) => setInspection(event.target.value)} placeholder="Метки на месте, следов установки нет…" rows={3} value={inspection} /></label>
          <label className="admin-field">Решение<select onChange={(event) => { setDecision(event.target.value); if (event.target.value === "refused") setAmount("0"); }} value={decision}>{decisions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="admin-field">Сумма возврата, L.<input disabled={decision === "refused"} max={chosen ? chosen.unitPriceMdl * chosen.quantity : undefined} min="0" onChange={(event) => setAmount(event.target.value)} type="number" value={amount} /></label>
          <label className="admin-field admin-field-wide">Причина решения<textarea onChange={(event) => setReason(event.target.value)} rows={2} value={reason} /></label>
        </div>
        <ImagePicker label="Фото при осмотре" onChange={(next) => { const src = next.part; if (src) setPhotos([...photos, src]); }} presets={["part"]} value={{}} />
        {photos.length > 0 && <p className="admin-muted">Фото добавлено: {photos.length}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions">
          <button className="admin-button" disabled={busy || !productId} onClick={async () => {
            setBusy(true); setError("");
            try {
              await staffCall("orders", { action: "create-return", orderId, productId, inspection, decision, amountMdl: Number(amount || 0), reason, photos: photos.map((src) => ({ src, closeup: false })) });
              setOpen(false); reset(); router.refresh();
            } catch (reason_) { setError(reason_ instanceof Error ? reason_.message : "Не удалось сохранить"); }
            finally { setBusy(false); }
          }} type="button">{busy ? "Сохраняем…" : "Сохранить решение"}</button>
          <button className="admin-ghost-button" onClick={() => setOpen(false)} type="button">Отмена</button>
        </div>
      </section>
    </div>}
  </section>;
}

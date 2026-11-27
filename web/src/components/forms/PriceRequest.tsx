"use client";

// Клиентский компонент: окно заявки открывается поверх страницы, без перехода на главную.
import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";
import { ContactLine, FormError, SentNotice, firstMissing } from "@/components/forms/RequestParts";
import type { Product } from "@/domain/catalog";
import { storedCarLabel } from "@/lib/selected-car-shared";

/**
 * «Узнать цену» / «Узнать наличие».
 *
 * Раньше кнопка уводила на главную к пустой общей форме, и оператор получал
 * «позвоните мне» без единого слова о детали. Теперь окно открывается на месте,
 * деталь уже подставлена (название, OEM, донор), машина — из выбранной покупателем.
 * На сервер уходит только номер детали в каталоге, остальное сервер берёт из базы.
 */
export function PriceRequest({ product, className = "", label = "Узнать цену" }: { product: Product; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [car, setCar] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ afterHours: boolean } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { setCar((current) => current || storedCarLabel()); element.showModal(); }
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowPhoneError(true);
    if (sending) return;
    if (!phoneValid) { setError("Проверьте номер телефона: например, +373 68 123 456."); return; }
    const missing = firstMissing(event.currentTarget);
    if (missing) { setError(missing); return; }
    setSending(true); setError("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, productId: product.id, vehicle: car, source: "catalog" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.message ?? "Не удалось отправить заявку. Повторите попытку."); return; }
      setSent({ afterHours: Boolean(data.afterHours) });
    } catch { setError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  const facts = [
    product.oem ? `OEM ${product.oem}` : "",
    product.sku ? `Артикул ${product.sku}` : "",
    product.donor ? `С машины: ${product.donor}` : "",
  ].filter(Boolean);

  return <>
    <button className={`flex h-11 items-center justify-center rounded-ui border border-accent px-3 text-btn font-bold text-accent hover:bg-accent hover:text-white ${className}`} data-price-request={product.id} onClick={() => setOpen(true)} type="button">{label}</button>
    <dialog aria-labelledby={`price-${product.id}`} className="m-auto w-full max-w-lg rounded-ui bg-white p-0 text-left backdrop:bg-ink/50" onClose={() => setOpen(false)} ref={dialog}>
      <div className="grid gap-4 p-4 xl:p-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-block font-bold text-ink" id={`price-${product.id}`}>{label}: {product.name}</h2>
          <button aria-label="Закрыть" className="grid h-10 w-10 shrink-0 place-items-center text-ink-2 hover:text-accent" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
        </div>
        {facts.length ? <ul className="grid gap-1 rounded-ui bg-surface-2 p-3 text-meta text-ink-2">{facts.map((fact) => <li className="break-words" key={fact}>{fact}</li>)}</ul> : null}
        {sent ? <SentNotice afterHours={sent.afterHours}><p className="mt-1 text-meta text-ink-2">Деталь и номер уже у оператора — пересказывать не придётся.</p></SentNotice> : <form className="grid gap-3" noValidate onSubmit={submit}>
          <label className="grid gap-1 text-body text-ink">Телефон<PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={showPhoneError} /></label>
          <label className="grid gap-1 text-body text-ink">Ваша машина<input className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" maxLength={200} onChange={(event) => setCar(event.target.value)} placeholder="Марка, модель, год — если знаете" value={car} /></label>
          <FormError message={error} />
          <button className="h-control rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50" disabled={sending} type="submit">{sending ? "Отправляем…" : "Отправить заявку"}</button>
          <p className="text-meta text-ink-2">Совместимость оператор сверит по номеру детали. Писать можно в любое время, ответ — с 8:00 до 20:00.</p>
        </form>}
        <ContactLine />
      </div>
    </dialog>
  </>;
}

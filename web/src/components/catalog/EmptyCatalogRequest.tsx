"use client";

// Клиентский компонент: заявка отправляется без перезагрузки страницы.
import { useState, type FormEvent } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";
import { ContactLine, FormError, SentNotice, firstMissing } from "@/components/forms/RequestParts";

/**
 * «Ничего не найдено» — не тупик. Запрос и машина уже подставлены: оператор проверит склад
 * (не всё снятое успевают завести на сайт) и перезвонит. Номер детали из запроса
 * сервер кладёт и в поле OEM, чтобы оператор искал сразу по нему.
 */
export function EmptyCatalogRequest({ query = "", car = "" }: { query?: string; car?: string }) {
  const [sent, setSent] = useState<{ afterHours: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setShowPhoneError(true);
    const missing = firstMissing(event.currentTarget);
    if (missing) { setError(missing); return; }
    if (!phoneValid) { setError("Проверьте номер телефона: например, +373 68 123 456."); return; }
    const form = new FormData(event.currentTarget);
    setSending(true); setError("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, part: form.get("part"), vehicle: form.get("vehicle"), query, source: "catalog" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.message ?? "Не удалось отправить заявку."); return; }
      setSent({ afterHours: Boolean(data.afterHours) });
    } catch { setError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  const field = "h-control w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent aria-[invalid=true]:border-accent";

  return <section className="grid min-w-0 gap-4 rounded-ui bg-white p-4 xl:p-6" data-empty-request>
    <div>
      <h2 className="text-block font-bold text-ink">Нет в каталоге, проверим склад</h2>
      <p className="mt-2 text-body text-ink-2">Не всё, что снято с машин, успели завести на сайт. Оставьте номер — оператор проверит склад и перезвонит.</p>
    </div>
    {sent ? <SentNotice afterHours={sent.afterHours} /> : <form className="grid min-w-0 gap-3 md:grid-cols-2" noValidate onSubmit={submit}>
      <label className="grid min-w-0 gap-1 text-body text-ink">Что ищете<input className={field} data-error="Напишите, какая деталь нужна." defaultValue={query} maxLength={200} name="part" placeholder="Название или номер детали" required /></label>
      <label className="grid min-w-0 gap-1 text-body text-ink">Машина<input className={field} defaultValue={car} maxLength={200} name="vehicle" placeholder="Марка, модель, год" /></label>
      <label className="grid min-w-0 gap-1 text-body text-ink">Телефон<PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={showPhoneError} /></label>
      <div className="flex min-w-0 items-end"><button className="h-control w-full rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50" disabled={sending} type="submit">{sending ? "Отправляем…" : "Проверить склад"}</button></div>
      <div className="md:col-span-2"><FormError message={error} /></div>
    </form>}
    <ContactLine />
  </section>;
}

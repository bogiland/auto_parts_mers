"use client";

// Клиентский компонент: заявка эксперту отправляется без перезагрузки.
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";
import { ContactLine, FormError, SentNotice, firstMissing } from "@/components/forms/RequestParts";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { storedCarLabel } from "@/lib/selected-car-shared";

const fieldClassName = "h-control w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent aria-[invalid=true]:border-accent";

/**
 * Заявка эксперту. Подбор по модели отсюда ушёл на первый экран (HomeCarPicker):
 * во второй вкладке под «Сомневаетесь…» его никто не находил.
 */
export function ExpertMatchTabs() {
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [sent, setSent] = useState<{ afterHours: boolean } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const [car, setCar] = useState("");

  useEffect(() => { setCar(storedCarLabel()); }, []);

  async function submitExpertRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowPhoneError(true);
    if (sending) return;
    const missing = firstMissing(event.currentTarget);
    if (missing) { setSubmitError(missing); return; }
    if (!phoneValid) { setSubmitError("Проверьте номер телефона: например, +373 68 123 456."); return; }
    const form = new FormData(event.currentTarget);
    setSending(true); setSubmitError("");
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, part: form.get("part"), vehicle: form.get("vehicle"), source: "expert" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setSubmitError(data.message ?? "Не удалось отправить заявку."); return; }
      setSent({ afterHours: Boolean(data.afterHours) });
    } catch { setSubmitError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  return (
    <section aria-labelledby="expert-match-title" className="min-w-0 scroll-mt-32" id="expert-request">
      <SectionTitle id="expert-match-title">Сомневаетесь в самостоятельном подборе? Эксперт подберёт запчасти бесплатно</SectionTitle>
      <div className="mt-4 grid min-w-0 gap-3 rounded-ui bg-surface-2 p-4">
        {sent ? <SentNotice afterHours={sent.afterHours} /> : (
          <form className="grid min-w-0 gap-2" noValidate onSubmit={submitExpertRequest}>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 desktop:grid-cols-[1fr_1fr_1fr_auto]">
              <PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={showPhoneError} />
              <input aria-label="Что ищете" className={fieldClassName} data-error="Напишите, какая деталь нужна." maxLength={200} name="part" placeholder="Что ищете" required />
              <input aria-label="Автомобиль: модель и год" className={`${fieldClassName} md:col-span-2 desktop:col-span-1`} defaultValue={car} key={car} maxLength={200} name="vehicle" placeholder="Автомобиль (модель, год)" />
              <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50 md:col-span-2 desktop:col-span-1 desktop:w-auto" disabled={sending} type="submit">{sending ? "Отправляем…" : "Отправить заявку"}</button>
            </div>
            <FormError message={submitError} />
            <div className="flex flex-col gap-2 text-meta md:flex-row md:items-center md:justify-between"><p className="text-ink-2">Писать можно в любое время. Отвечаем с 8:00 до 20:00.</p><p className="text-ink-3">Отправляя заявку, вы соглашаетесь с обработкой <Link className="underline hover:text-ink" href="/privacy">персональных данных</Link>.</p></div>
          </form>
        )}
        <ContactLine />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeVehiclePicker } from "./HomeVehiclePicker";

const selectClassName = "h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:text-ink-3";

export function ExpertMatchTabs({ cars = [] }: { cars?: { id: string; make: string; model: string; generation: string }[] }) {
  const [tab, setTab] = useState("expert");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);

  async function submitExpertRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowPhoneError(true);
    if (!phoneValid || sending) return;
    const form = new FormData(event.currentTarget);
    setSending(true); setSubmitError("");
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, part: form.get("part"), vehicle: form.get("vehicle"), source: "expert" }) });
      if (!response.ok) { setSubmitError((await response.json().catch(() => ({}))).message ?? "Не удалось отправить заявку."); return; }
      setSubmitted(true);
    } catch { setSubmitError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  return (
    <section aria-labelledby="expert-match-title" className="min-w-0" id="expert-request">
      <SectionTitle id="expert-match-title">Сомневаетесь в самостоятельном подборе? Эксперт подберёт запчасти бесплатно</SectionTitle>
      <div className="mt-4 flex min-w-0" role="tablist" aria-label="Подбор запчастей">{[["expert", "Помощь эксперта"], ["vehicle", "Подбор по модели"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={`rounded-ui px-4 py-3 text-nav font-bold ${tab === value ? "bg-surface-2 text-ink" : "text-ink-2"}`} onClick={() => setTab(value)} type="button">{label}</button>)}</div>
      {tab === "vehicle" ? <HomeVehiclePicker cars={cars} /> : <div className="min-w-0 rounded-ui bg-surface-2 p-4">
          <div>
            {submitted ? <p className="text-body text-ink-2">Заявка принята. Оператор свяжется с вами с 8:00 до 20:00.</p> : (
              <form onSubmit={submitExpertRequest}>
                <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 desktop:grid-cols-[1fr_1fr_1fr_auto]">
                  <PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={showPhoneError} />
                  <input aria-label="Что ищете" className={selectClassName} name="part" placeholder="Что ищете" required />
                  <input aria-label="Автомобиль: модель и год" className={`${selectClassName} md:col-span-2 desktop:col-span-1`} name="vehicle" placeholder="Автомобиль (модель, год)" />
                  <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50 md:col-span-2 desktop:col-span-1 desktop:w-auto" disabled={sending} type="submit">{sending ? "Отправляем…" : "Отправить заявку"}</button>
                </div>
                <input name="phone" type="hidden" value={phone} />
                {submitError ? <p className="text-body text-accent" role="alert">{submitError}</p> : null}
                <div className="mt-2 flex flex-col gap-2 text-meta md:flex-row md:items-center md:justify-between"><p className="text-ink-2">Уточним совместимость и свяжемся с вами с 8:00 до 20:00.</p><p className="text-ink-3">Отправляя заявку, вы соглашаетесь с обработкой <Link className="underline hover:text-ink" href="/privacy">персональных данных</Link>.</p></div>
              </form>
            )}
          </div>
      </div>}
    </section>
  );
}

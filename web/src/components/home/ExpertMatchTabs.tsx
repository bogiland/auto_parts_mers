"use client";

import { type FormEvent, useState } from "react";

import { PhoneInput } from "@/components/forms/PhoneInput";
import { SectionTitle } from "@/components/ui/SectionTitle";

type Tab = "expert" | "model";

const selectClassName = "h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent disabled:cursor-not-allowed disabled:text-ink-3";

export function ExpertMatchTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("expert");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [showPhoneError, setShowPhoneError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [model, setModel] = useState("");
  const [body, setBody] = useState("");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");

  function submitExpertRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowPhoneError(true);
    if (!phoneValid) return;
    setSubmitted(true);
  }

  return (
    <section aria-labelledby="expert-match-title" className="min-w-0">
      <SectionTitle id="expert-match-title" mobileChildren="Не уверены в подборе? Эксперт поможет бесплатно">Сомневаетесь в самостоятельном подборе? Эксперт подберёт запчасти бесплатно</SectionTitle>
      <div className="flex items-end" role="tablist" aria-label="Способ подбора запчастей">
        <button aria-controls="expert-panel" aria-selected={activeTab === "expert"} className={`rounded-t-ui px-3 py-3 text-nav font-bold ${activeTab === "expert" ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`} id="expert-tab" onClick={() => setActiveTab("expert")} role="tab" type="button">Помощь эксперта</button>
        <button aria-controls="model-panel" aria-selected={activeTab === "model"} className={`rounded-t-ui px-3 py-3 text-nav font-bold ${activeTab === "model" ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`} id="model-tab" onClick={() => setActiveTab("model")} role="tab" type="button">Подбор по модели</button>
      </div>
      <div className={`min-w-0 rounded-ui bg-surface-2 p-4 ${activeTab === "expert" ? "rounded-tl-none" : ""}`}>
        {activeTab === "expert" ? (
          <div aria-labelledby="expert-tab" id="expert-panel" role="tabpanel">
            {submitted ? <p className="text-body text-ink-2">Заявка принята. Эксперт скоро свяжется с вами.</p> : (
              <form onSubmit={submitExpertRequest}>
                <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 desktop:grid-cols-[1fr_1fr_1fr_auto]">
                  <PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={showPhoneError} />
                  <input aria-label="Что ищете" className={selectClassName} name="part" placeholder="Что ищете" required />
                  <input aria-label="Автомобиль: модель и год" className={`${selectClassName} md:col-span-2 desktop:col-span-1`} name="vehicle" placeholder="Автомобиль (модель, год)" />
                  <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover md:col-span-2 desktop:col-span-1 desktop:w-auto" type="submit">Отправить заявку</button>
                </div>
                <input name="phone" type="hidden" value={phone} />
                <div className="mt-2 flex flex-col gap-2 text-meta md:flex-row md:items-center md:justify-between"><p className="text-ink-2">Уточним совместимость и перезвоним в течение 15 минут.</p><p className="text-ink-3">Отправляя заявку, вы соглашаетесь с обработкой <a className="underline hover:text-ink" href="/privacy">персональных данных</a>.</p></div>
              </form>
            )}
          </div>
        ) : (
          <form action="/catalog/legkovye" aria-labelledby="model-tab" className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 desktop:grid-cols-6" id="model-panel" role="tabpanel">
            <select aria-label="Марка" className={selectClassName} disabled value="mercedes"><option value="mercedes">Mercedes-Benz</option></select>
            <select aria-label="Модель" className={selectClassName} onChange={(event) => { setModel(event.target.value); setBody(""); setYear(""); setEngine(""); }} value={model}><option value="">Модель</option><option value="c-class">C-Class</option><option value="e-class">E-Class</option><option value="gle">GLE</option></select>
            <select aria-label="Кузов" className={selectClassName} disabled={!model} onChange={(event) => { setBody(event.target.value); setYear(""); setEngine(""); }} value={body}><option value="">Кузов</option><option value="sedan">Седан</option><option value="wagon">Универсал</option></select>
            <select aria-label="Год" className={selectClassName} disabled={!body} onChange={(event) => { setYear(event.target.value); setEngine(""); }} value={year}><option value="">Год</option><option value="2024">2024</option><option value="2023">2023</option><option value="2022">2022</option></select>
            <select aria-label="Двигатель" className={selectClassName} disabled={!year} onChange={(event) => setEngine(event.target.value)} value={engine}><option value="">Двигатель</option><option value="2l">2.0 л</option><option value="3l">3.0 л</option></select>
            <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover md:col-span-2 desktop:col-span-1 desktop:w-auto" disabled={!engine} type="submit">Найти</button>
          </form>
        )}
      </div>
    </section>
  );
}

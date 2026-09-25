"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";

type Tab = "expert" | "model";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^373/, "").slice(0, 8);
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8)].filter(Boolean);
  return `+373${groups.length ? ` ${groups.join(" ")}` : ""}`;
}

const modelFields = [
  ["Модель", "model"],
  ["Год", "year"],
  ["Двигатель", "engine"],
] as const;

export function ExpertMatchTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("expert");
  const [phone, setPhone] = useState("+373");
  const [submitted, setSubmitted] = useState(false);

  function submitExpertRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function updatePhone(event: ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhone(event.target.value));
  }

  return (
    <section aria-labelledby="expert-match-title" className="min-w-0">
      <h2 className="mb-4 text-block font-bold text-ink" id="expert-match-title">Сомневаетесь в самостоятельном подборе? Эксперт подберёт запчасти бесплатно</h2>
      <div className="flex items-end" role="tablist" aria-label="Способ подбора запчастей">
        <button aria-controls="expert-panel" aria-selected={activeTab === "expert"} className={`rounded-t-ui px-3 py-3 text-body font-bold ${activeTab === "expert" ? "bg-surface-2 text-ink" : "text-muted-2 hover:text-ink"}`} id="expert-tab" onClick={() => setActiveTab("expert")} role="tab" type="button">Помощь эксперта</button>
        <button aria-controls="model-panel" aria-selected={activeTab === "model"} className={`rounded-t-ui px-3 py-3 text-body font-bold ${activeTab === "model" ? "bg-surface-2 text-ink" : "text-muted-2 hover:text-ink"}`} id="model-tab" onClick={() => setActiveTab("model")} role="tab" type="button">Подбор по модели</button>
      </div>
      <div className="min-w-0 rounded-ui rounded-tl-none bg-surface-2 p-3">
        {activeTab === "expert" ? (
          <div aria-labelledby="expert-tab" id="expert-panel" role="tabpanel">
            {submitted ? <p className="text-body text-ink-2">Заявка принята. Эксперт скоро свяжется с вами.</p> : (
              <form onSubmit={submitExpertRequest}>
                <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
                  <input aria-label="Ваш телефон" autoComplete="tel" className="h-control min-w-0 rounded-ui border border-transparent bg-white px-3 text-body text-ink outline-none placeholder:text-muted focus:border-accent" inputMode="tel" name="phone" onChange={updatePhone} placeholder="Ваш телефон" required type="tel" value={phone} />
                  <input aria-label="Что ищете" className="h-control min-w-0 rounded-ui border border-transparent bg-white px-3 text-body text-ink outline-none placeholder:text-muted focus:border-accent" name="part" placeholder="Что ищете" required />
                  <input aria-label="Автомобиль: модель и год" className="h-control min-w-0 rounded-ui border border-transparent bg-white px-3 text-body text-ink outline-none placeholder:text-muted focus:border-accent md:col-span-2 xl:col-span-1" name="vehicle" placeholder="Автомобиль (модель, год)" />
                  <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover md:col-span-2 xl:col-span-1 xl:w-auto" type="submit">Отправить заявку</button>
                </div>
                <div className="mt-2 flex flex-col gap-2 text-meta md:flex-row md:items-center md:justify-between"><p className="text-ink-2">Уточним совместимость и перезвоним в течение 15 минут.</p><p className="text-muted">Отправляя заявку, вы соглашаетесь с <a className="underline hover:text-ink" href="/privacy">обработкой персональных данных</a>.</p></div>
              </form>
            )}
          </div>
        ) : (
          <form action="/catalog/legkovye" aria-labelledby="model-tab" className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]" id="model-panel" role="tabpanel">
            {modelFields.map(([label, name]) => <select aria-label={label} className="h-control min-w-0 rounded-ui border border-transparent bg-white px-3 text-body text-ink outline-none focus:border-accent" defaultValue="" key={name} name={name}><option value="">{label}</option></select>)}
            <button className="h-control w-full rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover md:col-span-2 xl:col-span-1 xl:w-auto" type="submit">Найти</button>
          </form>
        )}
      </div>
    </section>
  );
}

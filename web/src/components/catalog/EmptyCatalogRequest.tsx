"use client";

import { useState } from "react";

export function EmptyCatalogRequest() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <section className="rounded-ui bg-white p-4"><h2 className="text-lead font-bold text-ink">Заявка принята</h2><p className="mt-2 text-body text-ink-2">Эксперт уточнит совместимость и свяжется с вами в течение 15 минут.</p></section>;

  return <section className="rounded-ui bg-white p-4"><h2 className="text-lead font-bold text-ink">Эксперт подберёт бесплатно</h2><p className="mt-2 text-body text-ink-2">Не нашли нужную деталь? Оставьте контакты, и мы поможем с подбором.</p><form className="mt-4 grid gap-2 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><input aria-label="Телефон" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" inputMode="tel" placeholder="Телефон" required type="tel" /><input aria-label="Что требуется" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" placeholder="Что требуется" required /><button className="h-control rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="submit">Оставить заявку</button></form></section>;
}

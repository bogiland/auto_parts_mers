"use client";
// Разворачивается по кнопке, поэтому живёт в браузере. Остальной подвал собирается на сервере.

import { useState } from "react";

export function FooterAbout({ copy }: { copy: string }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="border-b border-white/10 bg-header-dark py-6"><div className="container-site">
    <h2 className="text-lead font-bold text-white">О компании</h2>
    <p className={`mt-3 text-body text-white/60 ${expanded ? "" : "line-clamp-4"}`}>{copy}</p>
    <button aria-expanded={expanded} className="mt-2 text-nav font-bold text-accent hover:text-white" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "Свернуть" : "Читать полностью"}</button>
    <ul className="mt-3 space-y-1 text-meta text-white/60"><li>Детали примерно с 150 машин-доноров и новые расходники</li><li>Доставку и её стоимость согласует оператор</li><li>Подбор экспертом бесплатно: отвечаем с 8:00 до 20:00</li></ul>
  </div></section>;
}

"use client";

// Клиентский компонент: ссылка собирается из выбранных вязкости и допуска без перезагрузки.
import Link from "next/link";
import { useState } from "react";

/**
 * Подбор автохимии и масел по допуску и вязкости (П9). Марка машины для масла ничего не говорит:
 * ищут по вязкости (5W-30) и допуску производителя (MB 229.52) — их и спрашиваем.
 * Варианты — из шаблона характеристик масел, ссылка ведёт в раздел масел с фильтрами.
 */
export function ChemistryPicker({ viscosities, approvals, href }: { viscosities: string[]; approvals: string[]; href: string }) {
  const [viscosity, setViscosity] = useState("");
  const [approval, setApproval] = useState("");
  const params = new URLSearchParams();
  if (viscosity) params.set("a_viscosity", viscosity);
  if (approval) params.set("a_mb_approval", approval);
  const target = params.size ? `${href}?${params}` : href;
  const select = "h-11 w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent";
  return <div className="rounded-ui bg-white p-4 xl:p-6" data-chemistry-picker>
    <h2 className="text-lead font-bold text-ink">Подбор масла по допуску и вязкости</h2>
    <p className="mt-1 text-meta text-ink-2">Допуск и вязкость написаны в руководстве к машине и на крышке маслозаливной горловины.</p>
    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
      <select aria-label="Вязкость" className={select} onChange={(event) => setViscosity(event.target.value)} value={viscosity}>
        <option value="">Вязкость</option>
        {viscosities.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select aria-label="Допуск" className={select} onChange={(event) => setApproval(event.target.value)} value={approval}>
        <option value="">Допуск производителя</option>
        {approvals.map((item) => <option key={item}>{item}</option>)}
      </select>
      <Link className="inline-flex h-11 items-center justify-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href={target}>Показать масла</Link>
    </div>
  </div>;
}

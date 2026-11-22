"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Car = { id: string; make: string; model: string; generation: string };

export function HomeVehiclePicker({ cars }: { cars: Car[] }) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [generation, setGeneration] = useState("");
  const unique = (items: string[]) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const models = unique(cars.filter(c => c.make === make).map(c => c.model));
  const generations = unique(cars.filter(c => c.make === make && c.model === model).map(c => c.generation));
  const field = "h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink";
  return <section className="rounded-ui bg-surface-2 p-4">
    <h2 className="text-section font-bold">Выберите машину</h2>
    <p className="mt-2 text-body text-ink-2">Показываем автомобили, для которых есть детали в наличии.</p>
    {cars.length ? <form className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
      event.preventDefault();
      const ids = cars.filter(c => c.make === make && c.model === model && (!generation || c.generation === generation)).map(c => c.id);
      if (ids.length) router.push(`/search?donors=${encodeURIComponent(ids.join(","))}&availability=in_stock`);
    }}>
      <select aria-label="Марка" className={field} value={make} onChange={e => { setMake(e.target.value); setModel(""); setGeneration(""); }} required><option value="">Марка</option>{unique(cars.map(c => c.make)).map(x => <option key={x}>{x}</option>)}</select>
      <select aria-label="Модель" className={field} value={model} onChange={e => { setModel(e.target.value); setGeneration(""); }} disabled={!make} required><option value="">Модель</option>{models.map(x => <option key={x}>{x}</option>)}</select>
      <select aria-label="Поколение" className={field} value={generation} onChange={e => setGeneration(e.target.value)} disabled={!model || !generations.length}><option value="">Все поколения</option>{generations.map(x => <option key={x}>{x}</option>)}</select>
      <button className="h-control rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" disabled={!model}>Показать детали</button>
    </form> : <p className="mt-4 text-body text-ink-2">Пока нет автомобилей с доступными деталями. Оставьте заявку эксперту.</p>}
  </section>;
}

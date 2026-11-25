"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Подбор по марке на странице направления.
 *
 * Список машин приходит сверху, из того же справочника, что и меню и каталог:
 * он построен от доноров на площадке. Прежняя версия брала марки из файла
 * с модельным рядом новых машин — восемнадцать марок, из которых детали были
 * у одной, и четыре шага подбора (год, поколение, модификация), которые
 * заканчивались пустой страницей. Осталось три шага: марка, модель, кузов.
 */

export type PickerGeneration = { slug: string; name: string; inStock: number };
export type PickerModel = { slug: string; name: string; inStock: number; generations: PickerGeneration[] };
export type PickerMake = { slug: string; name: string; inStock: number; models: PickerModel[] };

type Option = { value: string; label: string };
type StoredCar = { brand?: string; model?: string; generation?: string };

function readLastCar(): StoredCar {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("naa:lastCar") ?? "{}") as StoredCar; } catch { return {}; }
}

function Field({ disabled = false, label, onChange, options, value }: { disabled?: boolean; label: string; onChange: (value: string) => void; options: Option[]; value: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleOptions = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())), [options, query]);
  const selected = options.find((option) => option.value === value);

  function selectOption(option: Option) { onChange(option.value); setQuery(""); setOpen(false); }

  return <div className="relative"><button aria-expanded={open} aria-haspopup="listbox" className="flex h-control w-full items-center rounded-ui border border-transparent bg-surface-2 px-3 text-left text-body text-ink outline-none focus:border-accent disabled:text-ink-3" disabled={disabled} onClick={() => { setOpen(true); setActiveIndex(0); }} type="button"><span className="min-w-0 flex-1 truncate">{selected?.label ?? label}</span>{value ? <span aria-label={`Сбросить ${label}`} className="mr-2 text-ink-3 hover:text-accent" onClick={(event) => { event.stopPropagation(); onChange(""); }} role="button"><X size={16} /></span> : null}<ChevronDown aria-hidden="true" size={18} /></button>{open ? <div className="fixed inset-0 z-[60] flex items-end bg-ink/40 md:absolute md:inset-auto md:top-full md:z-20 md:mt-1 md:block md:w-full md:bg-transparent"><div className="w-full rounded-t-ui bg-white p-4 shadow-card md:rounded-ui"><div className="flex items-center gap-2"><input aria-label={`Поиск: ${label}`} autoFocus className="h-control min-w-0 flex-1 rounded-ui bg-surface-2 px-3 text-body text-ink outline-none focus:ring-1 focus:ring-accent" onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter" && visibleOptions[activeIndex]) { event.preventDefault(); selectOption(visibleOptions[activeIndex]); } }} placeholder={`Поиск: ${label}`} value={query} /><button aria-label="Закрыть" className="grid h-10 w-10 place-items-center text-ink-2 hover:text-accent" onClick={() => setOpen(false)} type="button"><X size={20} /></button></div><div aria-label={label} className="mt-2 max-h-56 overflow-y-auto" role="listbox">{visibleOptions.length ? visibleOptions.map((option, index) => <button aria-selected={option.value === value} className={`flex min-h-11 w-full items-center rounded-ui px-3 text-left text-body ${index === activeIndex ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"}`} key={option.value} onClick={() => selectOption(option)} role="option" type="button">{option.label}</button>) : <p className="p-3 text-body text-ink-2">Нет совпадений. Оставьте заявку, и эксперт поможет с подбором.</p>}</div></div></div> : null}</div>;
}

export function VehiclePicker({ makes = [] }: { makes?: PickerMake[] }) {
  const router = useRouter();
  const [lastCar] = useState(readLastCar);
  const [article, setArticle] = useState("");
  const [brand, setBrand] = useState(lastCar.brand ?? "");
  const [model, setModel] = useState(lastCar.model ?? "");
  const [generation, setGeneration] = useState(lastCar.generation ?? "");

  const selectedMake = makes.find((item) => item.slug === brand);
  const selectedModel = selectedMake?.models.find((item) => item.slug === model);

  useEffect(() => {
    if (brand && model) try { localStorage.setItem("naa:lastCar", JSON.stringify({ brand, model, generation })); } catch { /* хранилище браузера необязательно */ }
  }, [brand, model, generation]);

  const brandOptions = makes.map((item) => ({ value: item.slug, label: `${item.name} · ${item.inStock} в наличии` }));
  const modelOptions = selectedMake
    ? selectedMake.models.map((item) => ({ value: item.slug, label: `${item.name} · ${item.inStock} в наличии` }))
    : [];
  const generationOptions = selectedModel?.generations.map((item) => ({ value: item.slug, label: `${item.name} · ${item.inStock} в наличии` })) ?? [];

  function chooseBrand(value: string) { setBrand(value); setModel(""); setGeneration(""); }
  function chooseModel(value: string) { setModel(value); setGeneration(""); }
  function findVehicle() {
    if (!brand || !model) return;
    router.push(["/catalog/legkovye", brand, model, generation].filter(Boolean).join("/"));
  }

  return <div className="rounded-ui bg-white p-4 desktop:p-6"><div className="flex min-w-0 flex-col gap-4 md:grid md:grid-cols-2 desktop:flex desktop:flex-row">
    <span className="order-2 text-center text-body text-ink-3 md:hidden">или</span>
    <form className="order-3 flex min-w-0 flex-1 flex-col justify-center border-t border-line pt-4 desktop:order-1 desktop:border-r desktop:border-t-0 desktop:pr-4 desktop:pt-0" onSubmit={(event) => { event.preventDefault(); if (article.trim()) router.push(`/search?q=${encodeURIComponent(article.trim())}`); }}><h2 className="text-lead font-bold text-ink">Поиск по артикулу</h2><label className="mt-3"><span className="sr-only">Артикул, OEM-номер или название детали</span><input className="h-control w-full rounded-ui bg-surface-2 px-3 text-body text-ink outline-none focus:ring-1 focus:ring-accent" onChange={(event) => setArticle(event.target.value)} placeholder="A000-420-91-20" value={article} /></label><button className="mt-3 ml-auto inline-flex h-btn items-center gap-2 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="submit"><Search size={16} />Найти</button></form>
    <span className="order-1 hidden self-center text-body text-ink-3 desktop:block">или</span>
    <div className="order-1 min-w-0 flex-1 desktop:order-3">
      <h2 className="text-lead font-bold text-ink">Поиск по марке</h2>
      {makes.length ? <>
        <p className="mt-2 text-meta text-ink-2">Показаны машины, детали с которых есть на складе.</p>
        <div className="mt-3 grid gap-2">
          <Field label="Марка" onChange={chooseBrand} options={brandOptions} value={brand} />
          <Field disabled={!brand} label="Модель" onChange={chooseModel} options={modelOptions} value={model} />
          {generationOptions.length > 1 ? <Field disabled={!model} label="Кузов" onChange={setGeneration} options={generationOptions} value={generation} /> : null}
        </div>
        <button className="mt-3 ml-auto inline-flex h-btn items-center gap-2 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:bg-ink-3" disabled={!brand || !model} onClick={findVehicle} type="button"><Search size={16} />Найти</button>
      </> : <p className="mt-3 text-body text-ink-2">Пока нет машин с доступными деталями. Оставьте заявку — эксперт подберёт деталь вручную.</p>}
    </div>
  </div></div>;
}

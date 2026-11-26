"use client";

// Клиентский компонент: шаги подбора меняются на лету, а выбор запоминается в браузере.
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import type { PickerMake } from "@/components/catalog/vehicle-picker";
import { rememberCar, storedCarLabel } from "@/lib/selected-car-shared";

/**
 * Подбор по машине на первом экране главной, рядом с поиском по номеру.
 *
 * Шаги: марка → модель → кузов. Шаг, где вариант один, проходится сам: у E-класса
 * на площадке только W212 — выбирать кузов незачем, сразу открывается выдача.
 * Поэтому от главной до карточки W212 — три действия: марка, модель, карточка.
 */
export function HomeCarPicker({ makes }: { makes: PickerMake[] }) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [current, setCurrent] = useState("");
  const [article, setArticle] = useState("");

  useEffect(() => { setCurrent(storedCarLabel()); }, []);

  const selectedMake = makes.find((item) => item.slug === make);
  const selectedModel = selectedMake?.models.find((item) => item.slug === model);

  function go(makeSlug: string, modelSlug: string, generationSlug = "") {
    const chosenMake = makes.find((item) => item.slug === makeSlug);
    const chosenModel = chosenMake?.models.find((item) => item.slug === modelSlug);
    const generation = chosenModel?.generations.find((item) => item.slug === generationSlug);
    if (!chosenMake || !chosenModel) return;
    const slug = [chosenMake.slug, chosenModel.slug, generation?.slug].filter(Boolean).join("/");
    const label = [chosenMake.name, chosenModel.name, generation && generation.name !== chosenModel.name ? generation.name : ""].filter(Boolean).join(" ");
    rememberCar({ slug, label });
    router.push(`/search?car=${encodeURIComponent(slug)}`);
  }

  function chooseMake(value: string) {
    setMake(value); setModel("");
    const next = makes.find((item) => item.slug === value);
    // Одна модель — выбирать нечего, идём дальше сами.
    if (next?.models.length === 1) chooseModel(value, next.models[0]!.slug);
  }

  function chooseModel(makeSlug: string, value: string) {
    setModel(value);
    const next = makes.find((item) => item.slug === makeSlug)?.models.find((item) => item.slug === value);
    if (next && next.generations.length <= 1) go(makeSlug, value, next.generations[0]?.slug);
  }

  function findArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (article.trim()) router.push(`/search?q=${encodeURIComponent(article.trim())}`);
  }

  const select = "h-control w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent disabled:text-ink-3";

  return <section aria-labelledby="car-picker-title" className="min-w-0 scroll-mt-32 rounded-ui bg-surface-2 p-4" id="car-picker">
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="min-w-0">
        <h2 className="text-block font-bold text-ink" id="car-picker-title">Подбор по машине</h2>
        {current ? <p className="mt-1 text-meta text-ink-2">Сейчас выбрано: {current}</p> : <p className="mt-1 text-meta text-ink-2">Показываем машины, детали с которых есть на складе.</p>}
        <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
          <select aria-label="Марка" className={select} onChange={(event) => chooseMake(event.target.value)} value={make}>
            <option value="">Марка</option>
            {makes.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.inStock}</option>)}
          </select>
          <select aria-label="Модель" className={select} disabled={!selectedMake} onChange={(event) => chooseModel(make, event.target.value)} value={model}>
            <option value="">Модель</option>
            {selectedMake?.models.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.inStock}</option>)}
          </select>
          <select aria-label="Кузов" className={select} disabled={!selectedModel || selectedModel.generations.length <= 1} onChange={(event) => go(make, model, event.target.value)} value="">
            <option value="">{selectedModel && selectedModel.generations.length <= 1 ? selectedModel.generations[0]?.name ?? "Кузов" : "Кузов"}</option>
            {selectedModel && selectedModel.generations.length > 1 ? selectedModel.generations.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.inStock}</option>) : null}
          </select>
        </div>
      </div>
      <form className="min-w-0" onSubmit={findArticle}>
        <h2 className="text-block font-bold text-ink">Поиск по номеру детали</h2>
        <p className="mt-1 text-meta text-ink-2">OEM или артикул — с дефисами, пробелами или без.</p>
        <div className="mt-2 flex min-w-0 gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Номер детали</span><input className={select} onChange={(event) => setArticle(event.target.value)} placeholder="A654-094-00-04" value={article} /></label>
          <button className="inline-flex h-control shrink-0 items-center gap-2 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="submit"><Search aria-hidden="true" size={16} />Найти</button>
        </div>
      </form>
    </div>
  </section>;
}

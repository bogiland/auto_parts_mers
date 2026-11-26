"use client";

// Клиентский компонент: форма пересчитывает «Показать N» на лету, пока человек ставит галочки.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { BrandFacet, CatalogFilters, SearchParamsRecord } from "@/lib/catalog-listing";
import type { Category } from "@/domain/catalog";

export type CarOption = { slug: string; label: string };

type FilterFormProps = {
  /** Настоящий адрес страницы: форма отправляется туда же, где человек находится. */
  action: string;
  baseParams: SearchParamsRecord;
  brands: BrandFacet[];
  cars: CarOption[];
  carSlug: string;
  filters: CatalogFilters;
  /** Где считать: собственная категория, встроенная или весь каталог. */
  scope: string;
  total: number;
  onDone?: () => void;
};

/** Поля, которыми управляет форма. Остальное (запрос, сортировка, вид) сохраняется как было. */
const own = ["availability", "brand", "car", "delivery", "model", "page", "price_from", "price_to", "vehicle"];

function keptParams(params: SearchParamsRecord) {
  return Object.entries(params)
    .filter(([key]) => !own.includes(key))
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).filter(Boolean).map((entry) => ({ key, value: entry as string })));
}

function queryOf(form: HTMLFormElement) {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    const text = String(value);
    // Пустое поле машины — это сброс машины, его надо передать; остальные пустые поля не нужны.
    if (text || key === "car") params.append(key, text);
  }
  return params;
}

const field = "h-10 w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent";

export function CatalogFilterForm({ action, baseParams, brands, cars, carSlug, filters, onDone, scope, total }: FilterFormProps) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(total);
  const [counting, setCounting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setCount(total); }, [total]);

  function recount() {
    if (!form.current) return;
    if (timer.current) clearTimeout(timer.current);
    const params = queryOf(form.current);
    params.set("scope", scope);
    timer.current = setTimeout(async () => {
      setCounting(true);
      try {
        const response = await fetch(`/api/catalog/count?${params}`, { cache: "no-store" });
        if (response.ok) setCount(Number((await response.json()).total ?? 0));
      } catch { /* счётчик — подсказка; без него форма всё равно работает */ }
      finally { setCounting(false); }
    }, 250);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryOf(event.currentTarget).toString();
    onDone?.();
    router.push(query ? `${action}?${query}` : action);
  }

  return <form action={action} className="grid min-w-0 gap-4" onChange={recount} onSubmit={submit} ref={form}>
    {keptParams(baseParams).map(({ key, value }, index) => <input key={`${key}-${index}`} name={key} type="hidden" value={value} />)}
    <fieldset className="grid min-w-0 gap-2"><legend className="text-body font-bold text-ink">Машина</legend>
      <select aria-label="Машина" className={field} defaultValue={carSlug} name="car">
        <option value="">Любая машина</option>
        {cars.map((car) => <option key={car.slug} value={car.slug}>{car.label}</option>)}
      </select>
    </fieldset>
    <fieldset className="grid min-w-0 gap-2"><legend className="text-body font-bold text-ink">Цена, L.</legend>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <input aria-label="Цена от" className={field} defaultValue={filters.priceFrom} inputMode="numeric" min={0} name="price_from" placeholder="От" type="number" />
        <input aria-label="Цена до" className={field} defaultValue={filters.priceTo} inputMode="numeric" min={0} name="price_to" placeholder="До" type="number" />
      </div>
    </fieldset>
    {brands.length ? <fieldset className="grid min-w-0 gap-2"><legend className="text-body font-bold text-ink">Производитель</legend>
      {brands.map((brand) => <label className="flex min-w-0 cursor-pointer items-start gap-2 text-body text-ink" key={brand.name}>
        <input className="mt-1 shrink-0" defaultChecked={filters.brands.includes(brand.name)} name="brand" type="checkbox" value={brand.name} />
        <span className="min-w-0 flex-1 break-words">{brand.name}</span>
        <span className="shrink-0 text-meta text-ink-2">{brand.count}</span>
      </label>)}
    </fieldset> : null}
    <fieldset className="grid min-w-0 gap-2"><legend className="text-body font-bold text-ink">Наличие</legend>
      <label className="flex items-center gap-2 text-body text-ink"><input defaultChecked={filters.availability === "in_stock"} name="availability" type="checkbox" value="in_stock" />В наличии</label>
    </fieldset>
    <button aria-live="polite" className="h-btn w-full rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-60" disabled={counting} type="submit">
      {count > 0 ? `Показать ${count}` : "Ничего не найдено — показать"}
    </button>
  </form>;
}

export function CatalogFilterSidebar({ categories, ...props }: FilterFormProps & { categories: Category[] }) {
  return <aside className="hidden min-w-0 rounded-ui bg-white p-4 lg:block">
    <h2 className="text-lead font-bold text-ink">Фильтры</h2>
    <nav aria-label="Категории" className="mt-4 grid min-w-0 gap-2 border-b border-line pb-4">
      {categories.map((category) => <Link className="flex min-w-0 justify-between gap-2 text-body text-ink-2 hover:text-accent" href={`/catalog/legkovye/${category.slug}`} key={category.id}><span className="min-w-0 break-words">{category.name}</span><span className="shrink-0 text-meta">{category.productCount}</span></Link>)}
    </nav>
    <div className="mt-4"><CatalogFilterForm {...props} /></div>
  </aside>;
}

"use client";

import { Grid2X2, List, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CatalogToolbarProps = {
  activeFilterCount: number;
  sort: "availability" | "price_asc" | "price_desc" | "relevance";
  view: "grid" | "list";
};

export function CatalogToolbar({ activeFilterCount, sort, view }: CatalogToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(name: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <button className="lg:hidden inline-flex h-btn items-center gap-2 rounded-ui border border-line bg-white px-3 text-btn font-bold text-ink" onClick={() => document.getElementById("catalog-filter-sheet")?.setAttribute("open", "")} type="button"><SlidersHorizontal aria-hidden="true" size={18} />Фильтры{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>
      <p className="text-body text-ink-2">Сортировка</p>
      <select aria-label="Сортировка товаров" className="h-10 min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" onChange={(event) => setParam("sort", event.target.value === "relevance" ? undefined : event.target.value)} value={sort}>
        <option value="relevance">По релевантности</option>
        <option value="price_asc">Сначала дешевле</option>
        <option value="price_desc">Сначала дороже</option>
        <option value="availability">По наличию</option>
      </select>
      <div className="ml-auto flex items-center rounded-ui border border-line bg-white p-1" role="group" aria-label="Вид выдачи">
        <button aria-label="Сетка" aria-pressed={view === "grid"} className={`grid h-8 w-8 place-items-center rounded-ui ${view === "grid" ? "bg-surface-2 text-accent" : "text-ink-2 hover:text-accent"}`} onClick={() => setParam("view")} type="button"><Grid2X2 aria-hidden="true" size={18} /></button>
        <button aria-label="Список" aria-pressed={view === "list"} className={`grid h-8 w-8 place-items-center rounded-ui ${view === "list" ? "bg-surface-2 text-accent" : "text-ink-2 hover:text-accent"}`} onClick={() => setParam("view", "list")} type="button"><List aria-hidden="true" size={18} /></button>
      </div>
    </div>
  );
}

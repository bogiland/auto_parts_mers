import Link from "next/link";

import type { BrandFacet, CatalogFilters, SearchParamsRecord } from "@/lib/catalog-listing";
import type { Category } from "@/domain/catalog";

type CatalogFilterSidebarProps = {
  action: string;
  baseParams: SearchParamsRecord;
  brands: BrandFacet[];
  categories: Category[];
  filters: CatalogFilters;
};

function filterHiddenParams(params: SearchParamsRecord) {
  return Object.entries(params)
    .filter(([key]) => !["availability", "brand", "delivery", "model", "page", "price_from", "price_to", "vehicle"].includes(key))
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).filter(Boolean).map((entry) => ({ key, value: entry as string })));
}

export function CatalogFilterForm({ action, baseParams, brands, filters }: Omit<CatalogFilterSidebarProps, "categories">) {
  return <form action={action} className="grid gap-4">
    {filterHiddenParams(baseParams).map(({ key, value }, index) => <input key={`${key}-${index}`} name={key} type="hidden" value={value} />)}
    <fieldset className="grid gap-2"><legend className="text-body font-bold text-ink">Цена</legend><div className="grid grid-cols-2 gap-2"><input aria-label="Цена от" className="h-10 min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" defaultValue={filters.priceFrom} inputMode="numeric" name="price_from" placeholder="От" type="number" /><input aria-label="Цена до" className="h-10 min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" defaultValue={filters.priceTo} inputMode="numeric" name="price_to" placeholder="До" type="number" /></div></fieldset>
    <fieldset className="grid gap-2"><legend className="text-body font-bold text-ink">Производитель</legend>{brands.map((brand) => <label className="flex cursor-pointer items-center gap-2 text-body text-ink" key={brand.name}><input defaultChecked={filters.brands.includes(brand.name)} name="brand" type="checkbox" value={brand.name} /><span className="min-w-0 flex-1 truncate">{brand.name}</span><span className="text-meta text-ink-2">{brand.count}{brand.fromPrice ? ` · от ${brand.fromPrice.toLocaleString("ru-RU")} L.` : ""}</span></label>)}</fieldset>
    <fieldset className="grid gap-2"><legend className="text-body font-bold text-ink">Наличие и срок</legend><label className="flex items-center gap-2 text-body text-ink"><input defaultChecked={filters.availability === "in_stock"} name="availability" type="checkbox" value="in_stock" />В наличии</label><label className="flex items-center gap-2 text-body text-ink"><input defaultChecked={filters.delivery === "today"} name="delivery" type="radio" value="today" />Сегодня</label><label className="flex items-center gap-2 text-body text-ink"><input defaultChecked={filters.delivery === "one_day"} name="delivery" type="radio" value="one_day" />Доставка от 1 дня</label></fieldset>
    <fieldset className="grid gap-2"><legend className="text-body font-bold text-ink">Марка и модель авто</legend><select aria-label="Марка автомобиля" className="h-10 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" defaultValue={filters.vehicle} name="vehicle"><option value="">Любая марка</option><option value="mercedes-benz">Mercedes-Benz</option></select><select aria-label="Модель автомобиля" className="h-10 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" defaultValue={filters.model} name="model"><option value="">Любая модель</option><option value="c-class">C-Class</option><option value="e-class">E-Class</option><option value="gle">GLE</option></select></fieldset>
    <button className="h-btn rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="submit">Применить</button>
  </form>;
}

export function CatalogFilterSkeleton() {
  return <aside className="hidden animate-pulse rounded-ui bg-white p-4 lg:block"><div className="h-6 w-24 rounded-ui bg-surface-2" /><div className="mt-5 h-20 rounded-ui bg-surface-2" /><div className="mt-4 h-32 rounded-ui bg-surface-2" /></aside>;
}

export async function CatalogFilterSidebar({ action, baseParams, brands, categories, filters }: CatalogFilterSidebarProps) {
  await Promise.resolve();
  return <aside className="hidden min-w-0 rounded-ui bg-white p-4 lg:block"><h2 className="text-lead font-bold text-ink">Фильтры</h2><nav aria-label="Категории" className="mt-4 grid gap-2 border-b border-line pb-4">{categories.map((category) => <Link className="text-body text-ink-2 hover:text-accent" href={`/catalog/${category.slug}`} key={category.id}>{category.name} <span className="text-meta">{category.productCount}</span></Link>)}</nav><div className="mt-4"><CatalogFilterForm action={action} baseParams={baseParams} brands={brands} filters={filters} /></div></aside>;
}

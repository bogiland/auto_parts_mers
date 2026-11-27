import { Fragment } from "react";
import { headers } from "next/headers";
import Link from "next/link";

import { AdSlot } from "@/components/ads/AdSlot";
import { CatalogFilterSidebar } from "@/components/catalog/CatalogFilterSidebar";
import { CarPlaque, RememberCar } from "@/components/catalog/CarPlaque";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyCatalogRequest } from "@/components/catalog/EmptyCatalogRequest";
import { MobileCatalogFilterSheet } from "@/components/catalog/MobileCatalogFilterSheet";
import { ProductCard } from "@/components/product/ProductCard";
import type { HomepageData } from "@/domain/catalog";
import { createCatalogListing, type SearchParamsRecord } from "@/lib/catalog-listing";
import { allow, windows } from "@/lib/rate-limit";
import { recordSearchMiss } from "@/lib/search-misses";
import { selectedCar } from "@/lib/selected-car";
import { showroomVehicles } from "@/lib/vehicles-db";
import { categoryTree, listAttrTemplates } from "@/lib/attributes-db";
import type { AttrTemplate } from "@/lib/attributes";

type CatalogResultsPageProps = {
  categoryName?: string;
  intro?: string;
  categorySlug?: string;
  ownCategoryId?: string;
  pathOverride?: string;
  homepage: HomepageData;
  isSearch?: boolean;
  searchParams: SearchParamsRecord;
};

type Chip = { key: string; label: string; value?: string };

const filterKeys = ["availability", "brand", "delivery", "model", "page", "price_from", "price_to", "vehicle"];

function toUrlSearchParams(source: SearchParamsRecord) {
  const params = new URLSearchParams();
  Object.entries(source).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).filter((entry) => entry !== undefined).forEach((entry) => params.append(key, entry as string));
  });
  return params;
}

function withParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function routeWith(pathname: string, source: SearchParamsRecord, key: string, value: string) {
  const params = toUrlSearchParams(source);
  params.delete(key);
  params.append(key, value);
  return withParams(pathname, params);
}

function removeChip(pathname: string, source: SearchParamsRecord, chip: Chip) {
  const params = toUrlSearchParams(source);
  const existingValues = params.getAll(chip.key);
  params.delete(chip.key);
  if (chip.value && chip.key === "brand") existingValues.filter((value) => value !== chip.value).forEach((value) => params.append(chip.key, value));
  params.delete("page");
  return withParams(pathname, params);
}

function clearFiltersUrl(pathname: string, source: SearchParamsRecord) {
  const params = toUrlSearchParams(source);
  filterKeys.forEach((key) => params.delete(key));
  [...params.keys()].filter((key) => key.startsWith("a_")).forEach((key) => params.delete(key));
  return withParams(pathname, params);
}

function activeChips(source: SearchParamsRecord): Chip[] {
  const values = (key: string) => (Array.isArray(source[key]) ? source[key] : source[key] ? [source[key] as string] : []);
  return [
    ...values("brand").map((value) => ({ key: "brand", label: value, value })),
    ...values("availability").map((value) => ({ key: "availability", label: value === "in_stock" ? "В наличии" : value, value })),
    ...values("price_from").map((value) => ({ key: "price_from", label: `от ${value} L.` })),
    ...values("price_to").map((value) => ({ key: "price_to", label: `до ${value} L.` })),
  ];
}

/**
 * Фильтры по характеристикам: все фильтруемые поля шаблона, по одному на ключ.
 * Показываются только те, у которых в выдаче есть значения, — пустых фильтров не бывает.
 */
export function filterableTemplates(templates: AttrTemplate[]) {
  const byKey = new Map<string, AttrTemplate>();
  for (const template of templates) if (template.filterable && !byKey.has(template.key)) byKey.set(template.key, template);
  return [...byKey.values()];
}

/** Откуда считать «Показать N»: та же область, что у страницы. */
function scopeOf(ownCategoryId?: string, categorySlug?: string) {
  if (ownCategoryId) return `own:${ownCategoryId}`;
  if (categorySlug) return `slug:${categorySlug}`;
  return "all";
}

/**
 * Выдача каталога и поиска — одна и та же страница, поэтому фильтр работает одинаково.
 * Машина берётся из адреса или куки и сужает выдачу до деталей с таких же доноров.
 */
export async function CatalogResultsPage({ categoryName, categorySlug, homepage, intro, isSearch = false, ownCategoryId, searchParams, pathOverride }: CatalogResultsPageProps) {
  const [{ car, explicit }, makes, templates, ownIds] = await Promise.all([selectedCar(searchParams), showroomVehicles(), listAttrTemplates(), ownCategoryId ? categoryTree(ownCategoryId) : Promise.resolve(undefined)]);
  const listing = createCatalogListing(homepage, searchParams, categorySlug, ownIds, car?.donorIds, filterableTemplates(templates));
  const pathname = pathOverride ?? (isSearch ? "/search" : `/catalog/legkovye/${categorySlug}`);
  const chips = activeChips(searchParams);
  const clearFilters = clearFiltersUrl(pathname, searchParams);
  const title = isSearch ? (listing.filters.query ? `Результаты поиска: «${listing.filters.query}»` : "Поиск запчастей") : categoryName ?? "Каталог запчастей";
  const resetCar = (() => { const params = toUrlSearchParams(searchParams); params.set("car", ""); params.delete("page"); return withParams(pathname, params); })();
  const cars = makes.flatMap((make) => make.models.flatMap((model) => (model.generations.length ? model.generations : [{ slug: "", name: "" }]).map((generation) => ({
    slug: [make.slug, model.slug, generation.slug].filter(Boolean).join("/"),
    label: [make.name, model.name, generation.name !== model.name ? generation.name : ""].filter(Boolean).join(" "),
  }))));
  const empty = listing.total === 0;

  // Пустой поиск записывается: это список того, что ищут и чего нет на сайте.
  // Предел по адресу — чтобы бот не забил журнал мусором; сверх предела просто не пишем.
  if (empty && isSearch && listing.filters.query) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    try { if (await allow("search-miss:ip", ip, windows.searchMissIp)) await recordSearchMiss(listing.filters.query, car?.label ?? ""); }
    catch { /* журнал — вспомогательный, выдача от него не зависит */ }
  }

  const formProps = {
    action: pathname, baseParams: searchParams, brands: listing.brandFacets, attrFacets: listing.attrFacets, cars, carSlug: car?.slug ?? "",
    filters: listing.filters, scope: scopeOf(ownCategoryId, categorySlug), total: listing.total,
  };

  return <main className="container-site section-stack">
    <RememberCar car={car ? { slug: car.slug, label: car.label } : null} explicit={explicit} />
    <section className="min-w-0">
      <p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / {isSearch ? "Поиск" : "Каталог"}{categoryName ? ` / ${categoryName}` : ""}</p>
      <h1 className="mt-2 break-words text-block font-bold text-ink">{title}</h1>
      {intro && <p className="mt-2 text-body text-ink-2">{intro}</p>}
      {car ? <div className="mt-2"><CarPlaque car={{ slug: car.slug, label: car.label, year: car.year }} resetHref={resetCar} /></div> : null}
    </section>
    <section className="flex min-w-0 flex-col gap-6 lg:flex-row">
      {/* При нуле результатов фильтры и сортировка не нужны: сужать нечего. Остаётся сброс и заявка. */}
      {!empty ? <div className="min-w-0 shrink-0 lg:w-64"><CatalogFilterSidebar categories={listing.categories} {...formProps} /></div> : null}
      <div className="min-w-0 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink-2">Найдено: {listing.total}</span>
          {chips.map((chip) => <Link className="rounded-badge bg-surface-2 px-2 py-1 text-meta text-ink-2 hover:text-accent" href={removeChip(pathname, searchParams, chip)} key={`${chip.key}-${chip.value ?? chip.label}`}>{chip.label} ×</Link>)}
          {chips.length ? <Link className="text-body text-accent hover:text-accent-hover" href={clearFilters}>Сбросить фильтры</Link> : null}
        </div>
        {!empty ? <>
          <div className="mt-4"><CatalogToolbar activeFilterCount={chips.length + (car ? 1 : 0)} sort={listing.filters.sort} view={listing.filters.view} /></div>
          <MobileCatalogFilterSheet {...formProps} />
          <div className={`mt-4 grid min-w-0 gap-2 md:gap-4 ${listing.filters.view === "list" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>{listing.products.map((product, index) => <Fragment key={product.id}><ProductCard carDonorIds={car?.donorIds} product={product} />{index === Math.min(3, listing.products.length - 1) && <AdSlot slot="catalog" />}</Fragment>)}</div>
          {listing.pageCount > 1 ? <nav aria-label="Страницы каталога" className="mt-6 flex flex-wrap justify-center gap-2">{Array.from({ length: listing.pageCount }, (_, index) => index + 1).map((page) => <Link aria-current={page === listing.filters.page ? "page" : undefined} className={`grid h-10 w-10 place-items-center rounded-ui text-body font-bold ${page === listing.filters.page ? "bg-accent text-white" : "bg-surface-2 text-ink hover:text-accent"}`} href={routeWith(pathname, searchParams, "page", String(page))} key={page}>{page}</Link>)}</nav> : null}
        </> : <div className="mt-4 grid gap-4">
          {car ? <p className="text-body text-ink-2">Для {car.label} здесь ничего нет. <Link className="text-accent hover:text-accent-hover" href={resetCar}>Показать для всех машин</Link></p> : null}
          <EmptyCatalogRequest car={car?.label ?? ""} query={listing.filters.query} />
        </div>}
      </div>
    </section>
  </main>;
}

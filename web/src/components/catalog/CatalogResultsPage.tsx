import { Suspense } from "react";
import Link from "next/link";

import { CatalogFilterForm, CatalogFilterSidebar, CatalogFilterSkeleton } from "@/components/catalog/CatalogFilterSidebar";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyCatalogRequest } from "@/components/catalog/EmptyCatalogRequest";
import { MobileCatalogFilterSheet } from "@/components/catalog/MobileCatalogFilterSheet";
import { ProductCard } from "@/components/product/ProductCard";
import type { HomepageData } from "@/domain/catalog";
import { createCatalogListing, type SearchParamsRecord } from "@/lib/catalog-listing";

type CatalogResultsPageProps = {
  categoryName?: string;
  categorySlug?: string;
  homepage: HomepageData;
  isSearch?: boolean;
  searchParams: SearchParamsRecord;
};

type Chip = { key: string; label: string; value?: string };

function toUrlSearchParams(source: SearchParamsRecord) {
  const params = new URLSearchParams();
  Object.entries(source).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).filter(Boolean).forEach((entry) => params.append(key, entry as string));
  });
  return params;
}

function routeWith(pathname: string, source: SearchParamsRecord, key?: string, value?: string) {
  const params = toUrlSearchParams(source);
  if (key) params.delete(key);
  if (key && value) params.append(key, value);
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function removeChip(pathname: string, source: SearchParamsRecord, chip: Chip) {
  const params = toUrlSearchParams(source);
  const existingValues = params.getAll(chip.key);
  params.delete(chip.key);
  if (chip.value && chip.key === "brand") existingValues.filter((value) => value !== chip.value).forEach((value) => params.append(chip.key, value));
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function clearFiltersUrl(pathname: string, source: SearchParamsRecord) {
  const params = toUrlSearchParams(source);
  ["availability", "brand", "delivery", "model", "page", "price_from", "price_to", "vehicle"].forEach((key) => params.delete(key));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function activeChips(source: SearchParamsRecord): Chip[] {
  const values = (key: string) => (Array.isArray(source[key]) ? source[key] : source[key] ? [source[key] as string] : []);
  return [
    ...values("brand").map((value) => ({ key: "brand", label: value, value })),
    ...values("availability").map((value) => ({ key: "availability", label: value === "in_stock" ? "В наличии" : value, value })),
    ...values("delivery").map((value) => ({ key: "delivery", label: value === "today" ? "Сегодня" : "От 1 дня", value })),
    ...values("vehicle").map((value) => ({ key: "vehicle", label: value === "mercedes-benz" ? "Mercedes-Benz" : value, value })),
    ...values("model").map((value) => ({ key: "model", label: value, value })),
    ...values("price_from").map((value) => ({ key: "price_from", label: `от ${value} L.` })),
    ...values("price_to").map((value) => ({ key: "price_to", label: `до ${value} L.` })),
  ];
}

export function CatalogResultsPage({ categoryName, categorySlug, homepage, isSearch = false, searchParams }: CatalogResultsPageProps) {
  const listing = createCatalogListing(homepage, searchParams, categorySlug);
  const pathname = isSearch ? "/search" : `/catalog/${categorySlug}`;
  const chips = activeChips(searchParams);
  const clearFilters = clearFiltersUrl(pathname, searchParams);
  const title = isSearch ? (listing.filters.query ? `Результаты поиска: «${listing.filters.query}»` : "Поиск запчастей") : categoryName ?? "Каталог запчастей";

  return <main className="container-site section-stack">
    <section className="min-w-0">
      <p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / {isSearch ? "Поиск" : "Каталог"}{categoryName ? ` / ${categoryName}` : ""}</p>
      <h1 className="mt-2 text-block font-bold text-ink">{title}</h1>
    </section>
    <section className="flex min-w-0 flex-col gap-6 lg:flex-row">
      <div className="shrink-0 lg:w-64"><Suspense fallback={<CatalogFilterSkeleton />}><CatalogFilterSidebar action={pathname} baseParams={searchParams} brands={listing.brandFacets} categories={listing.categories} filters={listing.filters} /></Suspense></div>
      <div className="min-w-0 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink-2">Найдено: {listing.total}</span>
          {chips.map((chip) => <Link className="rounded-badge bg-surface-2 px-2 py-1 text-meta text-ink-2 hover:text-accent" href={removeChip(pathname, searchParams, chip)} key={`${chip.key}-${chip.value ?? chip.label}`}>{chip.label} ×</Link>)}
          {chips.length ? <Link className="text-body text-accent hover:text-accent-hover" href={clearFilters}>Сбросить все</Link> : null}
        </div>
        <div className="mt-4"><CatalogToolbar activeFilterCount={chips.length} sort={listing.filters.sort} view={listing.filters.view} /></div>
        <MobileCatalogFilterSheet><CatalogFilterForm action={pathname} baseParams={searchParams} brands={listing.brandFacets} filters={listing.filters} /></MobileCatalogFilterSheet>
        {listing.products.length ? <><div className={`mt-4 grid min-w-0 gap-2 md:gap-4 ${listing.filters.view === "list" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>{listing.products.map((product) => <ProductCard key={product.id} product={product} />)}</div>{listing.pageCount > 1 ? <nav aria-label="Страницы каталога" className="mt-6 flex flex-wrap justify-center gap-2">{Array.from({ length: listing.pageCount }, (_, index) => index + 1).map((page) => <Link aria-current={page === listing.filters.page ? "page" : undefined} className={`grid h-10 w-10 place-items-center rounded-ui text-body font-bold ${page === listing.filters.page ? "bg-accent text-white" : "bg-surface-2 text-ink hover:text-accent"}`} href={routeWith(pathname, searchParams, "page", String(page))} key={page}>{page}</Link>)}</nav> : null}</> : <div className="mt-4"><EmptyCatalogRequest /></div>}
      </div>
    </section>
  </main>;
}

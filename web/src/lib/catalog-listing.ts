import type { Category, HomepageData, Product } from "@/domain/catalog";

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsRecord = Record<string, SearchParamValue>;

export type CatalogFilters = {
  availability?: "in_stock";
  brands: string[];
  delivery?: "today" | "one_day";
  model?: string;
  page: number;
  priceFrom?: number;
  priceTo?: number;
  query: string;
  sort: "availability" | "price_asc" | "price_desc" | "relevance";
  vehicle?: string;
  view: "grid" | "list";
};

export type BrandFacet = {
  count: number;
  fromPrice: number | null;
  name: string;
};

export type CatalogListing = {
  availableCount: number;
  brandFacets: BrandFacet[];
  categories: Category[];
  filters: CatalogFilters;
  pageCount: number;
  products: Product[];
  total: number;
};

const PAGE_SIZE = 24;

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function values(value: SearchParamValue) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

function positiveNumber(value: string | undefined) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : undefined;
}

function categoryForProduct(product: Product) {
  const value = `${product.id} ${product.name}`.toLocaleLowerCase("ru-RU");
  if (value.includes("колодк") || value.includes("тормозн") || value.includes("brake") || value.includes("disc")) return "brakes";
  if (value.includes("фильтр") || value.includes("filter")) return "filters";
  if (value.includes("аккумулятор") || value.includes("battery")) return "electrical";
  if (value.includes("стойк") || value.includes("strut")) return "suspension";
  if (value.includes("масло") || value.includes("oil") || value.includes("свеч")) return "engine";
  if (value.includes("колес") || value.includes("wheel")) return "accessories";
  return "accessories";
}

function matchesQuery(product: Product, query: string) {
  if (!query) return true;
  const source = `${product.name} ${product.brand} ${product.sku}`.toLocaleLowerCase("ru-RU");
  return query.toLocaleLowerCase("ru-RU").split(/\s+/).every((token) => source.includes(token));
}

function isAvailable(product: Product) {
  return product.priceMode === "fixed";
}

function deliveryFor(product: Product) {
  return product.priceMdl && product.priceMdl > 2000 ? "one_day" : "today";
}

function uniqueProducts(homepage: HomepageData) {
  return [...new Map([...homepage.popularProducts, ...homepage.recommendedProducts]
    .map((product) => [`${product.sku}:${product.name}`, product])).values()];
}

export function parseCatalogFilters(params: SearchParamsRecord): CatalogFilters {
  const sort = first(params.sort);
  const view = first(params.view);
  const availability = first(params.availability);
  const delivery = first(params.delivery);

  return {
    availability: availability === "in_stock" ? availability : undefined,
    brands: values(params.brand),
    delivery: delivery === "today" || delivery === "one_day" ? delivery : undefined,
    model: first(params.model) || undefined,
    page: Math.max(1, Math.floor(Number(first(params.page)) || 1)),
    priceFrom: positiveNumber(first(params.price_from)),
    priceTo: positiveNumber(first(params.price_to)),
    query: first(params.q)?.trim() ?? "",
    sort: sort === "price_asc" || sort === "price_desc" || sort === "availability" ? sort : "relevance",
    vehicle: first(params.vehicle) || undefined,
    view: view === "list" ? "list" : "grid",
  };
}

export function createCatalogListing(homepage: HomepageData, params: SearchParamsRecord, categorySlug?: string): CatalogListing {
  const filters = parseCatalogFilters(params);
  const allProducts = uniqueProducts(homepage);
  const scopedProducts = categorySlug ? allProducts.filter((product) => categoryForProduct(product) === categorySlug) : allProducts;
  const withoutBrand = scopedProducts
    .filter((product) => matchesQuery(product, filters.query))
    .filter((product) => !filters.priceFrom || (product.priceMdl ?? 0) >= filters.priceFrom)
    .filter((product) => !filters.priceTo || (product.priceMdl ?? 0) <= filters.priceTo)
    .filter((product) => !filters.availability || isAvailable(product))
    .filter((product) => !filters.delivery || deliveryFor(product) === filters.delivery)
    .filter(() => !filters.vehicle || filters.vehicle === "mercedes-benz")
    .filter(() => !filters.model || filters.vehicle === "mercedes-benz");
  const products = withoutBrand.filter((product) => !filters.brands.length || filters.brands.includes(product.brand));
  const brandFacets = [...new Set(withoutBrand.map((product) => product.brand))]
    .map((brand) => {
      const matches = withoutBrand.filter((product) => product.brand === brand);
      const prices = matches.map((product) => product.priceMdl).filter((price): price is number => price !== null);
      return { count: matches.length, fromPrice: prices.length ? Math.min(...prices) : null, name: brand };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
  const sorted = [...products].sort((left, right) => {
    if (filters.sort === "price_asc") return (left.priceMdl ?? Number.POSITIVE_INFINITY) - (right.priceMdl ?? Number.POSITIVE_INFINITY);
    if (filters.sort === "price_desc") return (right.priceMdl ?? -1) - (left.priceMdl ?? -1);
    if (filters.sort === "availability") return Number(isAvailable(right)) - Number(isAvailable(left));
    return 0;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  return {
    availableCount: scopedProducts.filter(isAvailable).length,
    brandFacets,
    categories: homepage.categories,
    filters: { ...filters, page },
    pageCount,
    products: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: sorted.length,
  };
}

export function categorySlugFromPath(value: string) {
  const aliases: Record<string, string> = {
    aksessuary: "accessories",
    dvigatel: "engine",
    elektrooborudovanie: "electrical",
    filtry: "filters",
    ohlazhdenie: "cooling",
    podveska: "suspension",
    tormoza: "brakes",
    transmissiya: "transmission",
  };
  return aliases[value] ?? value;
}

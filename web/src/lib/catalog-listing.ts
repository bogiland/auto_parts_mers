import type { Category, HomepageData, Product } from "@/domain/catalog";
import { formatValue, type AttrTemplate } from "@/lib/attributes";

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

/** Фильтр по характеристике: значения со счётчиками. Параметр в адресе — a_<ключ>. */
export type AttrFacet = { key: string; label: string; values: { value: string; label: string; count: number; checked: boolean }[] };

export type CatalogListing = {
  availableCount: number;
  brandFacets: BrandFacet[];
  attrFacets: AttrFacet[];
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

/** Номер детали без оформления: A654-094-00-04, a654 094 00 04 и A6540940004 — одно и то же. */
export function compactArticle(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]/gi, "");
}

export function matchesQuery(product: Pick<Product, "name" | "brand" | "sku" | "oem" | "donor">, query: string) {
  if (!query) return true;
  const source = `${product.name} ${product.brand} ${product.sku} ${product.oem ?? ""} ${product.donor ?? ""}`.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  const compactQuery = compactArticle(query);
  // Артикул и OEM сравниваются без дефисов, пробелов и точек, в любом регистре.
  if (compactQuery.length >= 4 && [product.sku, product.oem ?? ""].some((code) => code && compactArticle(code).includes(compactQuery))) return true;
  const compactSource = compactArticle(source);
  return query.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").split(/\s+/).filter(Boolean)
    .every((token) => source.includes(token) || (compactArticle(token).length > 0 && compactSource.includes(compactArticle(token))));
}

function isAvailable(product: Product) {
  return (product.stock??0)>0;
}

function uniqueProducts(homepage: HomepageData) {
  return [...new Map([...homepage.popularProducts, ...homepage.recommendedProducts, ...(homepage.liveProducts ?? [])]
    // Одна деталь — одна карточка: склад (liveProducts) идёт последним и в Map вытесняет стартовую витрину с тем же id.
    .map((product) => [product.id, product])).values()];
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

/** Выбранные значения характеристик из адреса: ?a_diameter_mm=320&a_ventilated=true */
export function attrSelections(params: SearchParamsRecord) {
  const result = new Map<string, string[]>();
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("a_") || !/^a_[a-z][a-z0-9_]{0,39}$/.test(key)) continue;
    const list = values(value).map(String).slice(0, 20);
    if (list.length) result.set(key.slice(2), list);
  }
  return result;
}

const attrText = (value: unknown) => (value === undefined || value === null ? "" : String(value));

export function createCatalogListing(homepage: HomepageData, params: SearchParamsRecord, categorySlug?: string, ownCategoryId?: string | string[], carDonorIds?: string[], attrTemplates: AttrTemplate[] = []): CatalogListing {
  const filters = parseCatalogFilters(params);
  const allProducts = uniqueProducts(homepage);
  // У категории из справочника владельца есть настоящая привязка, угадывать по названию не нужно.
  // Раздел показывает и детали своих подразделов — так же, как его считает счётчик в меню.
  const ownIds = ownCategoryId === undefined ? null : new Set(Array.isArray(ownCategoryId) ? ownCategoryId : [ownCategoryId]);
  const scopedProducts = ownIds
    ? allProducts.filter((product) => Boolean(product.categoryId && ownIds.has(product.categoryId)))
    : categorySlug ? allProducts.filter((product) => categoryForProduct(product) === categorySlug) : allProducts;
  const withoutBrand = scopedProducts
    .filter((product) => !first(params.donors) || (product.donorId && first(params.donors)!.split(",").includes(product.donorId)))
    .filter((product) => matchesQuery(product, filters.query))
    .filter((product) => !filters.priceFrom || (product.priceMdl ?? 0) >= filters.priceFrom)
    .filter((product) => !filters.priceTo || (product.priceMdl ?? 0) <= filters.priceTo)
    .filter((product) => !filters.availability || isAvailable(product))
    // Выбранная машина оставляет только детали, снятые с таких же доноров.
    // Раньше фильтр марки знал один Mercedes и ничего не отсеивал: после W213
    // в тормозах всплывали колодки W204 и Camry.
    .filter((product) => !carDonorIds || Boolean(product.donorId && carDonorIds.includes(product.donorId)));
  // Характеристики: значение совпадает с любым из выбранных. Деталь без значения под фильтр не попадает.
  const selected = attrSelections(params);
  const matchesAttrs = (product: Product, skip?: string) => [...selected].every(([key, wanted]) => key === skip || wanted.includes(attrText(product.attrs?.[key])));
  const products = withoutBrand.filter((product) => (!filters.brands.length || filters.brands.includes(product.brand)) && matchesAttrs(product));
  // Счётчик значения считается с остальными выбранными фильтрами, но без своего собственного:
  // иначе после выбора 320 мм все другие диаметры показывали бы ноль.
  const brandScoped = withoutBrand.filter((product) => !filters.brands.length || filters.brands.includes(product.brand));
  const attrFacets: AttrFacet[] = attrTemplates.filter((template) => template.filterable).map((template) => {
    const counts = new Map<string, number>();
    for (const product of brandScoped) {
      if (!matchesAttrs(product, template.key)) continue;
      const value = attrText(product.attrs?.[template.key]);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const chosen = selected.get(template.key) ?? [];
    return {
      key: template.key, label: template.labelRu,
      values: [...counts].map(([value, count]) => ({ value, count, checked: chosen.includes(value),
        label: formatValue(template, template.kind === "number" ? Number(value) : template.kind === "bool" ? value === "true" : value) }))
        .sort((left, right) => template.kind === "number" ? Number(left.value) - Number(right.value) : left.label.localeCompare(right.label, "ru")),
    };
  }).filter((facet) => facet.values.length > 0);
  // В фильтр попадают только настоящие бренды деталей. Деталь без бренда владелец ещё
  // не дозаполнил — пустую строку в список выбора ставить нельзя, выбрать её нечем.
  const brandBase = withoutBrand.filter((product) => matchesAttrs(product));
  const brandFacets = [...new Set(brandBase.map((product) => product.brand).filter(Boolean))]
    .map((brand) => {
      const matches = brandBase.filter((product) => product.brand === brand);
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
    attrFacets,
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
    interer: "interior",
    krepezh: "bearings",
    kuzov: "body",
    ohlazhdenie: "cooling",
    podveska: "suspension",
    rulevoe: "suspension",
    tormoza: "brakes",
    transmissiya: "transmission",
    vyhlop: "exhaust",
    zhidkosti: "filters",
  };
  return aliases[value] ?? value;
}

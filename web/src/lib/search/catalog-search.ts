import { getHomepage } from "@/lib/catalog-gateway";
import type { Product } from "@/domain/catalog";

import { normalizeArticle, normalizeQuery, parseQuery } from "./query";
import type { SearchBrand, SearchCategory, SearchSuggestionResponse } from "./types";

const categoryAliases: Record<string, string[]> = {
  engine: ["двигател", "мотор"],
  brakes: ["тормоз", "колодк", "диск"],
  suspension: ["подвес", "амортиз"],
  transmission: ["трансмисс", "коробк"],
  electrical: ["аккумулятор", "генератор", "стартер", "электр"],
  cooling: ["охлажден", "радиатор"],
  filters: ["фильтр", "масло"],
};

function searchTokens(value: string) {
  return normalizeQuery(value).split(" ").filter((item) => item.length > 1);
}

function containsEveryToken(source: string, query: string) {
  const normalizedSource = normalizeQuery(source);
  return searchTokens(query).every((token) => normalizedSource.includes(token));
}

function categoryScore(category: SearchCategory, query: string) {
  const normalized = normalizeQuery(query);
  const aliases = categoryAliases[category.slug] ?? [];
  if (normalizeQuery(category.name) === normalized) return 100;
  if (aliases.some((alias) => normalized.includes(alias))) return 80;
  return containsEveryToken(`${category.name} ${category.path}`, normalized) ? 50 : 0;
}

function productScore(product: Product, query: string) {
  const article = normalizeArticle(query);
  if (article.length > 3 && normalizeArticle(product.sku) === article) return 1000;
  if (normalizeArticle(product.sku).includes(article) && article.length > 3) return 800;
  if (containsEveryToken(`${product.name} ${product.brand} ${product.sku}`, query)) return 100;
  return 0;
}

function uniqueBySku(items: Product[]) {
  return [...new Map(items.map((item) => [`${item.sku}:${item.name}`, item])).values()];
}

export async function searchCatalog(query: string) {
  const homepage = await getHomepage();
  const parsed = parseQuery(query);
  const products = uniqueBySku([...homepage.popularProducts, ...homepage.recommendedProducts]);
  const categories: SearchCategory[] = homepage.categories.map((category) => ({
    name: category.name,
    path: `Запчасти / ${category.name}`,
    slug: category.slug,
  }));
  const searchedText = parsed.text || parsed.normalized;
  const filteredProducts = products
    .map((product) => ({ product, score: productScore(product, searchedText) }))
    .filter((item) => item.score > 0)
    .filter(({ product }) => !parsed.brand || normalizeQuery(product.brand) === parsed.brand)
    .filter(() => !parsed.vehicle || parsed.vehicle === "mercedes-benz")
    .sort((left, right) => right.score - left.score)
    .map(({ product }) => product);
  const filteredCategories = categories
    .map((category) => ({ category, score: categoryScore(category, searchedText) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ category }) => category);
  const brands: SearchBrand[] = [...new Set(products.map((product) => product.brand))]
    .filter((brand) => containsEveryToken(brand, searchedText))
    .map((name) => ({ name, slug: normalizeQuery(name).replace(/\s+/g, "-") }));

  return { categories: filteredCategories, parsed, products: filteredProducts, brands };
}

export async function getSuggestions(query: string): Promise<SearchSuggestionResponse> {
  const result = await searchCatalog(query);
  const exactCategory = result.categories.find((category) => normalizeQuery(category.name) === result.parsed.text);
  const searchParams = new URLSearchParams({ from_global: "true", q: query });
  if (result.parsed.vehicle) searchParams.set("vehicle", result.parsed.vehicle);
  if (result.parsed.brand) searchParams.set("brand", result.parsed.brand);

  return {
    products: result.products.slice(0, 6).map((product) => ({
      id: product.id,
      slug: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      price: product.priceMdl,
      thumb: product.image,
    })),
    categories: result.categories.slice(0, 4),
    brands: result.brands.slice(0, 3),
    redirect: exactCategory ? `/catalog/legkovye/${exactCategory.slug}?${searchParams}` : undefined,
  };
}

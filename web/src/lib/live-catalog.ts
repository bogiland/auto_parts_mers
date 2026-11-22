import "server-only";

import { getHomepage } from "@/lib/catalog-gateway";
import { getCheckoutCatalog, getSettings } from "@/lib/checkout-db";
import { publicCategories } from "@/lib/reference-db";
import { conditionLabel, publicParts, type PartRow } from "@/lib/parts-db";
import type { Category, Product } from "@/domain/catalog";
import { rating,ratings } from "@/lib/reviews";

// Категории из справочника владельца вытесняют демонстрационные, как только в справочнике появилась первая запись.
export async function liveCategories(fallback: Category[]): Promise<Category[]> {
  const own = (await publicCategories());
  if (!own.length) return fallback;
  return own.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    productCount: category.parts,
    image: { alt: category.name, url: category.image },
    isVisible: true,
  }));
}

// Для блока категорий на главной: верхний уровень справочника становится вкладками, вложенные — плитками.
export async function ownCategoryGroups() {
  return (await publicCategories()).map((category) => ({
    id: category.id,
    label: category.name,
    href: `/catalog/legkovye/${category.slug}`,
    image: category.image,
    children: category.children.map((child) => ({ id: child.id, title: child.name, href: `/catalog/legkovye/${child.slug}`, image: child.image })),
  }));
}

const placeholder = "/images/products/neutral-placeholder.png";

/** Деталь из склада в том виде, в котором её показывает витрина. */
export async function toStoreProduct(part: PartRow): Promise<Product> {
  const [settings, summary] = await Promise.all([getSettings(), rating(part.id)]);
  return mapStoreProduct(part, settings.rubPerMdl, summary);
}

function mapStoreProduct(part: PartRow, rate: number | null, summary?: { average: number; count: number } | null): Product {
  const cover = part.photos[0]?.preview || part.photos[0]?.src || "";
  return {
    id: part.id,
    sku: part.sku || part.id,
    oem: part.oem || undefined,
    name: part.nameRu,
    brand: part.donorTitle || "NAA.md",
    priceMdl: part.priceMdl,
    priceMode: part.priceMode === "on_request" ? "on_request" : "fixed",
    rating: summary?.average??0,
    reviewCount: summary?.count??0,
    image: { alt: part.nameRu, url: cover || placeholder },
    images: part.photos.length ? part.photos.map((photo) => ({ alt: part.nameRu, url: photo.src })) : undefined,
    stock: part.stock,
    priceRub: part.priceMdl !== null && rate !== null && rate > 0 ? Math.round(part.priceMdl * rate) : undefined,
    condition: conditionLabel(part.condition) || undefined,
    donor: part.donorTitle || undefined,
    donorId: part.donorId ?? undefined,
    categoryId: part.categoryId ?? undefined,
    returnRestricted: part.returnRestricted,
  };
}

export async function getLiveHomepage({ includeInventory = true }: { includeInventory?: boolean } = {}) {
  const [homepage, settings, summary] = await Promise.all([getHomepage(), getSettings(), ratings()]);
  const ids = [...new Set([...homepage.popularProducts, ...homepage.recommendedProducts].map(({ id }) => id))];
  const [checkoutProducts, categories, inventory] = await Promise.all([
    getCheckoutCatalog({ ids, rate: settings.rubPerMdl }),
    liveCategories(homepage.categories),
    includeInventory ? publicParts() : [],
  ]);
  const current = new Map(checkoutProducts.map((product) => [product.id, product]));
  const live = (product: Product): Product => {
    const row = current.get(product.id);
    const review = summary.get(product.id);
    const details = row ? { stock: row.stock, priceMdl: row.priceMdl, priceRub: row.priceRub ?? undefined, priceMode: row.priceMode === "on_request" ? "on_request" as const : "fixed" as const } : { stock: 0 };
    return { ...product, ...details, rating: review?.average ?? 0, reviewCount: review?.count ?? 0 };
  };
  return {
    ...homepage,
    categories,
    liveProducts: inventory.map((part) => mapStoreProduct(part, settings.rubPerMdl, summary.get(part.id))),
    phone: settings.phones.moldova,
    hours: settings.operatorHours,
    popularProducts: homepage.popularProducts.map(live),
    recommendedProducts: homepage.recommendedProducts.map(live),
  };
}

import "server-only";

import { getHomepage } from "@/lib/catalog-gateway";
import { getCheckoutCatalog, getSettings } from "@/lib/checkout-db";
import { publicCategories } from "@/lib/reference-db";
import { conditionLabel, publicParts, type PartRow } from "@/lib/parts-db";
import type { Category, Product } from "@/domain/catalog";

// Категории из справочника владельца вытесняют демонстрационные, как только в справочнике появилась первая запись.
export function liveCategories(fallback: Category[]): Category[] {
  const own = publicCategories();
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
export function ownCategoryGroups() {
  return publicCategories().map((category) => ({
    id: category.id,
    label: category.name,
    href: `/catalog/legkovye/${category.slug}`,
    image: category.image,
    children: category.children.map((child) => ({ id: child.id, title: child.name, href: `/catalog/legkovye/${child.slug}`, image: child.image })),
  }));
}

const placeholder = "/images/categories/accessories.png";

/** Деталь из склада в том виде, в котором её показывает витрина. */
export function toStoreProduct(part: PartRow): Product {
  const rate = getSettings().rubPerMdl;
  const cover = part.photos[0]?.preview || part.photos[0]?.src || "";
  return {
    id: part.id,
    sku: part.sku || part.id,
    name: part.nameRu,
    brand: part.donorTitle || "NAA.md",
    priceMdl: part.priceMdl,
    priceMode: part.priceMode === "on_request" ? "on_request" : "fixed",
    rating: 0,
    reviewCount: 0,
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

export function liveProducts(): Product[] {
  return publicParts().map(toStoreProduct);
}

export async function getLiveHomepage() {
  const homepage = await getHomepage();
  const settings = getSettings();
  const current = new Map(getCheckoutCatalog().map((product) => [product.id, product]));
  const live = (product: Product): Product => {
    const row = current.get(product.id);
    return row ? { ...product, stock: row.stock, priceMdl: row.priceMdl, priceRub: row.priceRub ?? undefined, priceMode: row.priceMode === "on_request" ? "on_request" : "fixed" } : { ...product, stock: 0 };
  };
  return { ...homepage, categories: liveCategories(homepage.categories), liveProducts: liveProducts(), phone: settings.phones.moldova, hours: settings.operatorHours, popularProducts: homepage.popularProducts.map(live), recommendedProducts: homepage.recommendedProducts.map(live) };
}

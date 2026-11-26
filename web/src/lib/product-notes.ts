import type { Product } from "@/domain/catalog";

/** Что сказать про совместимость. Подтверждена только деталь с такого же донора — остальное сверяет оператор. */
export function compatibilityNote(product: Product, carDonorIds?: string[]) {
  if (product.donorId && carDonorIds?.includes(product.donorId)) return "Снята с такой же машины";
  if (!product.donorId) return "Совместимость сверит оператор по номеру";
  return "";
}

/** Наличие словами. «В наличии» с ценой «уточнить» сбивало с толку — такая деталь идёт «по запросу». */
export function availabilityNote(product: Product) {
  if ((product.stock ?? 0) <= 0) return "Продано";
  if (product.priceMode === "on_request" || product.priceMdl === null) return "По запросу · Слободзея";
  return "В наличии · Слободзея";
}

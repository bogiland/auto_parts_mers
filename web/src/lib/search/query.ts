import { getBrands } from "@/lib/vehicles";

import type { ParsedQuery } from "./types";

const aliases = [
  ["мерседес", "mercedes-benz"],
  ["мерс", "mercedes-benz"],
  ["мб", "mercedes-benz"],
  ["mercedes", "mercedes-benz"],
  ["колодки", "тормозные колодки"],
] as const;

const partBrands = ["bosch", "trw", "mann", "mann-filter", "brembo", "lemforder", "febi", "mahle", "sachs", "hella", "varta", "mobil 1", "mercedes-benz"];

export function normalizeQuery(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticle(value: string) {
  return normalizeQuery(value).replace(/[^a-zа-я0-9]/gi, "");
}

export function parseQuery(value: string): ParsedQuery {
  let normalized = normalizeQuery(value);

  for (const [alias, replacement] of aliases) {
    normalized = normalized.replace(new RegExp(`(^|\\s)${alias}(?=\\s|$)`, "g"), `$1${replacement}`);
  }

  const vehicle = getBrands().find((brand) => normalized.includes(normalizeQuery(brand.name)))?.slug;
  const brand = partBrands.find((item) => normalized.includes(item));
  let text = normalized;

  if (vehicle) {
    const vehicleName = getBrands().find((item) => item.slug === vehicle)?.name;
    if (vehicleName) text = text.replace(normalizeQuery(vehicleName), " ");
  }

  if (brand) text = text.replace(brand, " ");

  return { normalized, text: text.replace(/\s+/g, " ").trim(), vehicle, brand };
}

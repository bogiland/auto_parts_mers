import type { MediaAsset } from "@/domain/catalog";

export type ParsedQuery = {
  normalized: string;
  text: string;
  vehicle?: string;
  brand?: string;
};

export type SearchCategory = {
  name: string;
  slug: string;
  path: string;
};

export type SearchBrand = {
  name: string;
  slug: string;
};

export type ProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  price: number | null;
  thumb: MediaAsset;
};

export type SearchSuggestionResponse = {
  products: ProductSuggestion[];
  categories: SearchCategory[];
  brands: SearchBrand[];
  redirect?: string;
};

export type Locale = "ru" | "ro";

export type PriceMode = "fixed" | "on_request";

export interface MediaAsset {
  alt: string;
  url: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  image: MediaAsset;
  isVisible: boolean;
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: MediaAsset;
  isEnabled: boolean;
  sortOrder: number;
}

export interface HomepageData {
  phone: string;
  hours: string;
  heroSlides: HeroSlide[];
  categories: Category[];
  popularProducts: Product[];
  recommendedProducts: Product[];
  posts: PostPreview[];
}

export interface PostPreview {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  href: string;
  image: MediaAsset;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  priceMdl: number | null;
  priceMode: PriceMode;
  rating: number;
  reviewCount: number;
  image: MediaAsset;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  name: string;
  slug: string;
}

export interface OrderDraft {
  items: Array<{ productId: string; quantity: number }>;
  contactPhone: string;
}

export interface VinRequest {
  vin: string;
  contactPhone: string;
  message?: string;
}

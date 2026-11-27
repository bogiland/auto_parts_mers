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
  /** Детали, заведённые владельцем в админке. Витрина показывает их вместе с демонстрационными. */
  liveProducts?: Product[];
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
  oem?: string;
  name: string;
  brand: string;
  priceMdl: number | null;
  priceMode: PriceMode;
  rating: number;
  reviewCount: number;
  image: MediaAsset;
  images?: MediaAsset[];
  stock?: number;
  priceRub?: number;
  condition?: string;
  donor?: string;
  donorId?: string;
  categoryId?: string;
  location?: string;
  returnRestricted?: boolean;
  /** П6: характеристики по шаблону и кросс-номера. */
  attrs?: Record<string, string | number | boolean>;
  crossNumbers?: { number: string; source: string }[];
  /** Код состояния (new, good, defect, parts) и строка состояния от оператора. */
  conditionId?: string;
  conditionNote?: string;
  partTypeId?: string;
  /** Донор целиком — происхождение детали: «Снято с: W212 2013 2.2 CDI». */
  donorCar?: { make: string; model: string; generation: string; year: number | null; engine: string };
  /** Миниатюра 96 px для ленты галереи. */
  thumbs?: string[];
  /** Отметки «крупный план дефекта» по фото. */
  closeups?: boolean[];
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

import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Product } from "@/domain/catalog";

type ProductCardProps = {
  product: Product;
  discount?: boolean;
  variant?: "default" | "featured";
  className?: string;
};

function priceLabel(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
}

function oldPriceLabel(product: Product, discount: boolean) {
  return discount && product.priceMode === "fixed" && product.priceMdl ? `${Math.round(product.priceMdl / 0.7).toLocaleString("ru-RU")} L.` : null;
}

function ProductImage({ product, discount, featured = false }: Pick<ProductCardProps, "product" | "discount"> & { featured?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-ui ${featured ? "h-40 w-40 shrink-0" : "aspect-[188/122]"}`}>
      <Link aria-label={product.name} className="absolute inset-0" href={`/products/${product.id}`}><Image alt={product.image.alt} className="object-contain" fill sizes="(min-width:1200px) 220px, (min-width:768px) 33vw, 50vw" src={product.image.url} /></Link>
      <button aria-label={`Добавить ${product.name} в избранное`} className="absolute right-0 top-0 grid h-6 w-6 place-items-center text-muted hover:text-accent" type="button"><Heart aria-hidden="true" size={20} strokeWidth={1.7} /></button>
      {discount ? <span className="absolute bottom-1 left-0 rounded-badge bg-deal px-1.5 text-badge font-bold text-white">-30%</span> : null}
    </div>
  );
}

function ProductDetails({ product, discount }: Pick<ProductCardProps, "product" | "discount">) {
  const oldPrice = oldPriceLabel(product, Boolean(discount));
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className={`mt-2 text-price font-bold ${discount && isFixedPrice ? "text-deal" : "text-ink"}`}>{priceLabel(product)}{oldPrice ? <span className="ml-2 text-body font-medium text-muted line-through">{oldPrice}</span> : null}</p>
      <p className="mt-1 truncate text-meta text-ink-2">{product.brand} · {product.sku}</p>
      <h3 className="mt-1 line-clamp-2 min-h-[calc(var(--lh-body)*2)] text-body font-bold text-ink">{product.name}</h3>
      <div className="mt-auto pt-3"><button className={`h-btn w-full rounded-ui text-btn font-bold ${isFixedPrice ? "bg-accent text-white hover:bg-accent-hover" : "border border-accent bg-white text-accent hover:bg-surface-2"}`} type="button">{isFixedPrice ? "В корзину" : "Узнать цену"}</button></div>
      <p className="mt-2 text-center text-body text-ink-2">Доставка от <span className="font-bold">1 дня</span></p>
    </div>
  );
}

export function ProductCard({ className = "", discount = false, product, variant = "default" }: ProductCardProps) {
  if (variant === "featured") {
    return <article className={`flex h-full min-w-0 items-center gap-4 rounded-ui bg-white ${className}`}><ProductImage discount={discount} featured product={product} /><ProductDetails discount={discount} product={product} /></article>;
  }

  return <article className={`flex h-full min-w-0 flex-col card-pad rounded-ui bg-white shadow-card xl:shadow-none xl:hover:shadow-card ${className}`}><ProductImage discount={discount} product={product} /><ProductDetails discount={discount} product={product} /></article>;
}

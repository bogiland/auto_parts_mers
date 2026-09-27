"use client";

import { Check, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/domain/catalog";

type ProductCardProps = {
  product: Product;
  discount?: boolean;
  className?: string;
};

function priceLabel(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
}

function oldPriceLabel(product: Product, discount: boolean) {
  return discount && product.priceMode === "fixed" && product.priceMdl
    ? `${Math.round(product.priceMdl / 0.7).toLocaleString("ru-RU")} L.`
    : null;
}

export function ProductCard({ className = "", discount = false, product }: ProductCardProps) {
  const [isFavourite, setIsFavourite] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const oldPrice = oldPriceLabel(product, discount);
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;
  const images = product.images?.length ? product.images : [product.image];
  const image = images[0]!;

  return (
    <article className={`flex h-full min-w-0 flex-col rounded-ui bg-white p-3 transition-shadow hover:shadow-card-hover ${className}`}>
      <div className="relative aspect-square min-w-0">
        <Link aria-label={product.name} className="absolute inset-0" href={`/products/${product.id}`}>
          <Image alt={image.alt} className="object-contain" fill sizes="(min-width: 1200px) 16.666vw, (min-width: 768px) 33.333vw, 50vw" src={image.url} />
        </Link>
        <button aria-label={isFavourite ? `Убрать ${product.name} из избранного` : `Добавить ${product.name} в избранное`} className={`absolute right-0 top-0 grid h-6 w-6 place-items-center ${isFavourite ? "text-accent" : "text-ink-3 hover:text-accent"}`} onClick={() => setIsFavourite((current) => !current)} type="button">
          <Heart aria-hidden="true" fill={isFavourite ? "currentColor" : "none"} size={20} strokeWidth={1.7} />
        </button>
        {discount ? <span className="absolute bottom-0 left-0 rounded-badge bg-accent px-1.5 text-badge font-bold text-white">-9%</span> : null}
        {images.length > 1 ? <div aria-label={`Фотография 1 из ${images.length}`} className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1"><span className="h-1 w-1 rounded-full bg-accent" />{images.slice(1).map((entry) => <span className="h-1 w-1 rounded-full bg-line" key={entry.url} />)}</div> : null}
      </div>
      <p className={`mt-2 whitespace-nowrap text-price font-bold ${discount && isFixedPrice ? "text-accent" : "text-ink"}`}>{priceLabel(product)}{oldPrice ? <span className="ml-2 text-meta font-normal text-ink-3 line-through">{oldPrice}</span> : null}</p>
      <p className="mt-1 truncate text-meta text-ink-2">{product.brand} · {product.sku}</p>
      <h3 className="mt-1 line-clamp-2 min-h-10 text-nav font-bold text-ink">{product.name}</h3>
      <div className="mt-auto pt-2">
        <button className={`flex h-9 w-full items-center justify-center gap-1 rounded-ui text-btn font-bold ${isInCart ? "border border-accent bg-white text-accent" : isFixedPrice ? "bg-accent text-white hover:bg-accent-hover" : "border border-accent bg-white text-accent hover:bg-surface-2"}`} onClick={() => isFixedPrice && setIsInCart((current) => !current)} type="button">
          {isInCart ? <><span>В корзине</span><Check aria-hidden="true" size={16} /></> : isFixedPrice ? "В корзину" : "Узнать цену"}
        </button>
      </div>
      <p className="mt-2 text-center text-meta text-ink-2">сегодня в 13:30</p>
    </article>
  );
}

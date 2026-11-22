"use client";

import { CartControl } from "@/components/cart/CartControl";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { useCurrency } from "@/components/header/CurrencySwitch";
import Image from "next/image";
import Link from "next/link";

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
  const currency = useCurrency();
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
        <FavoriteButton className="absolute right-0 top-0 h-6 w-6" id={product.id} name={product.name} />
        {discount ? <span className="absolute bottom-0 left-0 rounded-badge bg-accent px-1.5 text-badge font-bold text-white">-9%</span> : null}
        {images.length > 1 ? <div aria-label={`Фотография 1 из ${images.length}`} className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1"><span className="h-1 w-1 rounded-full bg-accent" />{images.slice(1).map((entry) => <span className="h-1 w-1 rounded-full bg-line" key={entry.url} />)}</div> : null}
      </div>
      <p className={`mt-2 whitespace-nowrap text-price font-bold ${discount && isFixedPrice ? "text-accent" : "text-ink"}`}>{currency === "rub" && product.priceRub !== undefined && product.priceMode === "fixed" ? `≈ ${product.priceRub.toLocaleString("ru-RU")} руб. ПМР` : priceLabel(product)}{oldPrice && currency === "mdl" ? <span className="ml-2 text-meta font-normal text-ink-3 line-through">{oldPrice}</span> : null}</p>
      {product.priceRub !== undefined && product.priceMode === "fixed" && <p className="text-meta text-ink-2">{currency === "rub" ? priceLabel(product) : `≈ ${product.priceRub.toLocaleString("ru-RU")} руб. ПМР`}</p>}
      <p className="mt-1 truncate text-meta text-ink-2">{product.brand} · {product.sku}</p>
      <h3 className="mt-1 line-clamp-2 min-h-10 text-nav font-bold text-ink">{product.name}</h3>
      {product.reviewCount>0&&<p className="text-meta text-ink-2 mt-2">★ {product.rating.toFixed(1)} · {product.reviewCount} отзывов</p>}
      <div className="mt-auto pt-2">
        <CartControl className="w-full" product={product} />
      </div>
      <p className="mt-2 text-center text-meta text-ink-2">{(product.stock??0)>0?'В наличии · Слободзея':'Продано'}</p>
    </article>
  );
}

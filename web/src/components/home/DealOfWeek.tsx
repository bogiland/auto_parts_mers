"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/domain/catalog";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionTitle } from "@/components/ui/SectionTitle";

function oldPrice(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${Math.round(product.priceMdl / 0.7).toLocaleString("ru-RU")} L.` : null;
}

function price(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
}

function DealHeading() {
  return (
    <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
      <SectionTitle className="mb-0">Товар недели</SectionTitle>
      <span className="shrink-0 text-body text-ink-2">Осталось <b className="mx-1 inline-grid h-10 min-w-6 place-items-center rounded-badge bg-surface-2 px-2 font-bold text-ink">4</b> дня</span>
    </div>
  );
}

function DealImage({ product }: { product: Product }) {
  return (
    <Link aria-label={product.name} className="deal-product-image relative block shrink-0" href={`/products/${product.id}`}>
      <Image alt={product.image.alt} className="object-contain" fill sizes="140px" src={product.image.url} />
    </Link>
  );
}

function DealDetails({ product }: { product: Product }) {
  const previousPrice = oldPrice(product);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="w-fit rounded-badge bg-accent px-1.5 text-badge font-bold text-white">-30%</span>
      <p className="mt-1 whitespace-nowrap text-price font-bold text-accent">{price(product)}{previousPrice ? <span className="ml-2 text-meta font-normal text-ink-3 line-through">{previousPrice}</span> : null}</p>
      <p className="mt-1 truncate text-meta text-ink-2">{product.brand} · {product.sku}</p>
      <h3 className="mt-1 line-clamp-2 text-body font-bold text-ink">{product.name}</h3>
      <button className="mt-2 h-9 w-fit rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="button">В корзину</button><p className="mt-2 text-meta text-ink-2">Доставка от 1 дня</p>
    </div>
  );
}

export function DealOfWeek({ products }: { products: Product[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const featured = products[currentIndex];
  if (!featured) return null;

  const previousProduct = () => setCurrentIndex((index) => (index - 1 + products.length) % products.length);
  const nextProduct = () => setCurrentIndex((index) => (index + 1) % products.length);

  return (
    <aside aria-label="Товар недели" className="min-w-0">
      <div className="deal-desktop-card hidden h-full min-w-0 rounded-ui border border-line bg-white desktop:flex desktop:flex-col">
        <DealHeading />
        <div className="relative flex min-w-0 flex-1 items-center gap-4">
          <button aria-label="Предыдущий товар недели" className="absolute -left-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card hover:text-accent" onClick={previousProduct} type="button"><ChevronLeft size={18} /></button>
          <DealImage product={featured} />
          <DealDetails product={featured} />
          <button aria-label="Следующий товар недели" className="absolute -right-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card hover:text-accent" onClick={nextProduct} type="button"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="min-w-0 desktop:hidden">
        <DealHeading />
        <ProductRail discount products={products.slice(0, 6)} />
      </div>
    </aside>
  );
}

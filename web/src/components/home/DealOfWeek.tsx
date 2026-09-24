"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/domain/catalog";

function priceLabel(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
}

function oldPriceLabel(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${Math.round(product.priceMdl / 0.7).toLocaleString("ru-RU")} L.` : null;
}

function DealHeading() {
  return <div className="mb-4 flex min-w-0 items-center justify-between gap-4"><h2 className="text-block font-bold text-ink">Товар недели</h2><span className="shrink-0 text-lead text-ink-2">Осталось <b className="mx-1 inline-grid h-10 min-w-6 place-items-center rounded-badge bg-surface-2 px-2 font-bold text-ink">4</b> дня</span></div>;
}

function DealCard({ product }: { product: Product }) {
  const oldPrice = oldPriceLabel(product);

  return (
    <article className="flex min-w-0 shrink-0 basis-[calc((100%-16px)/2)] flex-col md:basis-[calc((100%-32px)/3)] lg:basis-[calc((100%-64px)/5)]">
      <Link aria-label={product.name} className="relative aspect-[1.3/1] overflow-hidden" href={`/products/${product.id}`}><Image alt={product.image.alt} className="object-contain" fill sizes="(max-width: 767px) 48vw, (max-width: 991px) 31vw, 19vw" src={product.image.url} /></Link>
      <span className="mt-2 w-fit rounded-badge bg-deal px-1.5 text-badge font-bold text-white">-30%</span>
      <p className="mt-2 text-price font-bold text-deal">{priceLabel(product)}{oldPrice ? <span className="ml-2 text-body font-medium text-muted line-through">{oldPrice}</span> : null}</p>
      <p className="mt-1 truncate text-body text-ink-2">{product.brand} · {product.sku}</p>
      <h3 className="mt-1 line-clamp-3 min-h-[calc(var(--lh-body)*2)] text-body font-bold text-ink">{product.name}</h3>
      <button className="mt-3 h-10 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="button">В корзину</button>
      <p className="mt-2 text-center text-body text-ink-2"><b>сегодня</b> <span className="text-muted">16:00</span></p>
    </article>
  );
}

export function DealOfWeek({ products }: { products: Product[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const featured = products[currentIndex];
  if (!featured) return null;

  const oldPrice = oldPriceLabel(featured);
  const previousProduct = () => setCurrentIndex((index) => (index - 1 + products.length) % products.length);
  const nextProduct = () => setCurrentIndex((index) => (index + 1) % products.length);

  return (
    <aside aria-label="Товар недели" className="min-w-0">
      <div className="hidden h-full min-w-0 rounded-ui border border-line p-4 xl:flex xl:flex-col xl:p-6">
        <DealHeading />
        <div className="relative flex min-w-0 flex-1 items-center gap-4">
          <button aria-label="Предыдущий товар недели" className="absolute -left-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-card hover:text-accent" onClick={previousProduct} type="button"><ChevronLeft size={18} /></button>
          <Link aria-label={featured.name} className="relative h-40 w-40 shrink-0" href={`/products/${featured.id}`}><Image alt={featured.image.alt} className="object-contain" fill sizes="160px" src={featured.image.url} /></Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="w-fit rounded-badge bg-deal px-1.5 text-badge font-bold text-white">-30%</span>
            <h3 className="mt-2 line-clamp-3 text-lead font-bold text-ink">{featured.name}</h3>
            <p className="mt-1 truncate text-body text-ink-2">{featured.brand} · {featured.sku}</p>
            <p className="mt-2 text-price font-bold text-deal">{priceLabel(featured)}{oldPrice ? <span className="ml-2 text-body font-medium text-muted line-through">{oldPrice}</span> : null}</p>
            <button className="mt-3 h-10 w-fit rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" type="button">В корзину</button>
            <p className="mt-2 text-body text-ink-2"><b>сегодня</b> <span className="text-muted">16:00</span></p>
          </div>
          <button aria-label="Следующий товар недели" className="absolute -right-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-card hover:text-accent" onClick={nextProduct} type="button"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="xl:hidden"><DealHeading /><div className="scroller-x min-w-0 gap-4" data-scroller>{products.slice(0, 5).map((product) => <DealCard key={product.id} product={product} />)}</div></div>
    </aside>
  );
}

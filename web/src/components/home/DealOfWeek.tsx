"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { Product } from "@/domain/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductRail } from "@/components/product/ProductRail";

function DealHeading() {
  return <div className="mb-4 flex min-w-0 items-center justify-between gap-4"><h2 className="text-block font-bold text-ink">Товар недели</h2><span className="shrink-0 text-lead text-ink-2">Осталось <b className="mx-1 inline-grid h-10 min-w-6 place-items-center rounded-badge bg-surface-2 px-2 font-bold text-ink">4</b> дня</span></div>;
}

export function DealOfWeek({ products }: { products: Product[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const featured = products[currentIndex];
  if (!featured) return null;

  const previousProduct = () => setCurrentIndex((index) => (index - 1 + products.length) % products.length);
  const nextProduct = () => setCurrentIndex((index) => (index + 1) % products.length);

  return (
    <aside aria-label="Товар недели" className="min-w-0">
      <div className="hidden h-full min-w-0 rounded-ui border border-line p-4 xl:flex xl:flex-col xl:p-6">
        <DealHeading />
        <div className="relative flex min-w-0 flex-1 items-center gap-4">
          <button aria-label="Предыдущий товар недели" className="absolute -left-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-card hover:text-accent" onClick={previousProduct} type="button"><ChevronLeft size={18} /></button>
          <ProductCard discount product={featured} variant="featured" />
          <button aria-label="Следующий товар недели" className="absolute -right-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-card hover:text-accent" onClick={nextProduct} type="button"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="xl:hidden"><DealHeading /><ProductRail discount products={products.slice(0, 5)} /></div>
    </aside>
  );
}

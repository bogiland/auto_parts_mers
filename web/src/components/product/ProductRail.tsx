"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { Product } from "@/domain/catalog";

import { ProductCard } from "./ProductCard";

export function ProductRail({ discount = false, products }: { discount?: boolean; products: Product[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(products.length / 6));
  const visibleProducts = products.slice(page * 6, (page + 1) * 6);

  function move(direction: number) {
    setPage((currentPage) => (currentPage + direction + pageCount) % pageCount);
  }

  return (
    <div className="min-w-0">
      <div className="scroller-x min-w-0 gap-2 md:gap-4 desktop:hidden" data-scroller>
        {products.map((product) => <div className="min-w-0 shrink-0 basis-[calc((100%-8px)/2)] md:basis-[calc((100%-32px)/3)] lg:basis-[calc((100%-48px)/4)]" key={product.id}><ProductCard discount={discount} product={product} /></div>)}
      </div>
      <div className="relative hidden min-w-0 desktop:block">
        <button aria-label="Предыдущие товары" className="absolute -left-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card hover:text-accent" onClick={() => move(-1)} type="button"><ChevronLeft size={20} /></button>
        <div className="grid min-w-0 grid-cols-6 gap-4">{visibleProducts.map((product) => <ProductCard discount={discount} key={product.id} product={product} />)}</div>
        <button aria-label="Следующие товары" className="absolute -right-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card hover:text-accent" onClick={() => move(1)} type="button"><ChevronRight size={20} /></button>
        <div className="mt-4 flex justify-center gap-1.5" aria-label={`Страница ${page + 1} из ${pageCount}`}>{Array.from({ length: pageCount }, (_, index) => <button aria-label={`Перейти к странице ${index + 1}`} className={`h-1.5 w-1.5 rounded-full ${index === page ? "bg-accent" : "bg-muted"}`} key={index} onClick={() => setPage(index)} type="button" />)}</div>
      </div>
    </div>
  );
}

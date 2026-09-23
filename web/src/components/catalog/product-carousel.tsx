"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Product } from "@/domain/catalog";

import { ProductCard } from "./product-card";

function cardsPerPage(width: number) {
  if (width < 600) return 2;
  if (width < 1024) return 3;
  return 6;
}

export function ProductCarousel({ products }: { products: Product[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(6);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(products.length / perPage));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updatePerPage = () => {
      const nextPerPage = cardsPerPage(viewport.clientWidth);
      setPerPage(nextPerPage);
      setPage((currentPage) => Math.min(currentPage, Math.ceil(products.length / nextPerPage) - 1));
    };

    updatePerPage();

    const observer = new ResizeObserver(updatePerPage);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [products.length]);

  function goToPage(nextPage: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const targetPage = Math.max(0, Math.min(pageCount - 1, nextPage));
    viewport.scrollTo({ left: viewport.clientWidth * targetPage, behavior: "smooth" });
    setPage(targetPage);
  }

  return (
    <div className="product-carousel">
      <div className="product-carousel__viewport" onScroll={(event) => setPage(Math.min(pageCount - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)))} ref={viewportRef}>
        <div className="product-carousel__track">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </div>
      <div className="product-carousel__footer">
        <button aria-label="Предыдущие товары" disabled={page === 0} onClick={() => goToPage(page - 1)} type="button"><ChevronLeft size={18} /></button>
        <div aria-label={`Страница ${page + 1} из ${pageCount}`} className="product-carousel__dots">{Array.from({ length: pageCount }, (_, index) => <button aria-label={`Перейти к товарам ${index * perPage + 1}–${Math.min(products.length, (index + 1) * perPage)}`} className={page === index ? "is-active" : ""} key={index} onClick={() => goToPage(index)} type="button" />)}</div>
        <button aria-label="Следующие товары" disabled={page === pageCount - 1} onClick={() => goToPage(page + 1)} type="button"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

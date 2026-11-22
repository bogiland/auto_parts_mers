"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { CartControl } from "@/components/cart/CartControl";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import type { Product } from "@/domain/catalog";

export function ProductDetails({ product }: { product: Product }) {
  const images = product.images?.length ? product.images : [product.image];
  const [activeImage, setActiveImage] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const image = images[activeImage] ?? images[0]!;
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;

  function moveImage(offset: number) {
    setActiveImage((index) => (index + offset + images.length) % images.length);
  }

  return (
    <article className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-x-8">
      <header className="min-w-0 xl:col-start-2 xl:row-start-1">
        <h1 className="break-words text-section font-bold text-ink">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <FavoriteButton className="h-10 w-10 rounded-ui border border-line" id={product.id} name={product.name} />
          {product.reviewCount > 0 && <a href="#reviews" className="text-meta text-ink-2 hover:text-accent">★ {product.rating.toFixed(1)} · отзывов: {product.reviewCount}</a>}
        </div>
      </header>

      <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
        <div className="relative aspect-[16/9] touch-pan-y overflow-hidden rounded-ui bg-surface sm:aspect-[3/1] xl:aspect-square"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStart.current = images.length > 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchCancel={() => { touchStart.current = null; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const touch = event.changedTouches[0];
            touchStart.current = null;
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(touch.clientY - start.y)) moveImage(dx < 0 ? 1 : -1);
          }}>
          <Image alt={image.alt} className="object-contain" fill priority={activeImage === 0} sizes="(min-width: 1200px) 50vw, (min-width: 576px) 60vw, 100vw" src={image.url} />
          {images.length > 1 && <>
            <button type="button" aria-label="Предыдущее фото" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-ui bg-white text-ink shadow-card" onClick={() => moveImage(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" aria-label="Следующее фото" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-ui bg-white text-ink shadow-card" onClick={() => moveImage(1)}><ChevronRight aria-hidden="true" /></button>
            <span aria-live="polite" className="sr-only">Фото {activeImage + 1} из {images.length}</span>
          </>}
        </div>
        {images.length > 1 && (
          <div className="scroller-x mt-2 min-w-0 gap-2 p-1" data-scroller role="group" aria-label="Фотографии товара">
            {images.map((item, index) => (
              <button aria-label={`Показать фотографию ${index + 1}`} aria-pressed={activeImage === index}
                className={`relative aspect-square w-12 shrink-0 snap-start overflow-hidden rounded-ui border xl:w-16 ${activeImage === index ? "border-accent" : "border-line"}`}
                key={`${item.url}-${index}`} onClick={() => setActiveImage(index)} type="button">
                <Image alt="" className="object-contain" fill sizes="(min-width: 1200px) 64px, 48px" src={item.url} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-start-2 xl:row-start-2">
        <section>
          <h2 className="rounded-ui bg-surface-2 px-4 py-3 text-block font-bold">Характеристики</h2>
          <dl className="px-4 text-body [&>div]:grid [&>div]:grid-cols-2 [&>div]:gap-4 [&>div]:border-b [&>div]:border-line [&>div]:py-3 [&_dt]:text-ink-2 [&_dd]:min-w-0 [&_dd]:break-words">
            <div><dt>Артикул</dt><dd>{product.sku}</dd></div>
            <div><dt>Бренд</dt><dd>{product.brand}</dd></div>
            {product.condition && <div><dt>Состояние</dt><dd>{product.condition}</dd></div>}
            {product.donor && <div><dt>Снято с машины</dt><dd>{product.donorId ? <Link className="underline hover:text-accent" href={`/donors/${product.donorId}`}>{product.donor}</Link> : product.donor}</dd></div>}
          </dl>
        </section>

        <section>
          <h2 className="rounded-ui bg-surface-2 px-4 py-3 text-block font-bold">Цена и наличие</h2>
          <div className="px-4 pt-4">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center">
              <div className="min-w-0">
                <p className={`text-price font-bold ${isFixedPrice ? "text-accent" : "text-ink"}`}>{isFixedPrice ? `${isFixedPrice.toLocaleString("ru-RU")} L.` : "Уточнить цену"}</p>
                {typeof product.stock === "number" && <p className={`mt-1 text-body ${product.stock > 0 ? "text-success" : "text-ink-2"}`}>{product.stock > 0 ? `${product.stock} шт. на складе` : "Нет в наличии"}</p>}
              </div>
              {product.returnRestricted && <p className="rounded-ui bg-surface-2 p-3 text-meta text-ink sm:order-last sm:col-span-2">Двигатели, коробки передач и агрегаты в сборе возврату не подлежат. Осмотрите деталь при получении.</p>}
              <CartControl className="w-full" product={product} />
            </div>
            <p className="mt-3 text-meta text-ink-2">Стоимость и срок доставки уточнит оператор.</p>
          </div>
        </section>
      </div>
    </article>
  );
}

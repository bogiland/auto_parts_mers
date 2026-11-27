"use client";

// Клиентский компонент: галерея листается касанием, а кнопка корзины меняется без перезагрузки.
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { CartControl } from "@/components/cart/CartControl";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { PriceRequest } from "@/components/forms/PriceRequest";
import { messengerPhone, messengerPhoneLabel } from "@/components/forms/RequestParts";
import type { Product } from "@/domain/catalog";
import { availabilityNote, compatibilityNote } from "@/lib/product-notes";

/** Всё, что карточка знает о детали сверх витрины: характеристики, применимость, возврат. */
export type CardFacts = {
  specs: { key: string; label: string; value: string }[];
  fitments: { id: number; make: string; model: string; generation: string; yearFrom: number | null; yearTo: number | null; engine: string; verified: boolean }[];
  returnLine: { restricted: boolean; text: string };
  conditionNote: string;
  applicability: string;
};

const noPhoto = "/images/no-photo.png";

function priceText(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} руб.` : "Цена по запросу";
}

/** «Снято с: Mercedes-Benz E-класс W212 2013 2.2 CDI» — машина целиком, с мотором. */
function donorLine(product: Product) {
  const car = product.donorCar;
  if (!car) return product.donor ?? "";
  return [car.make, car.model, car.generation, car.year ? String(car.year) : "", car.engine].filter(Boolean).join(" ");
}

export function ProductDetails({ product, car, facts }: { product: Product; car?: { label: string; year: string; donorIds: string[] } | null; facts?: CardFacts }) {
  const realImages = product.images?.length ? product.images : product.image.url && product.image.url !== noPhoto ? [product.image] : [];
  const [activeImage, setActiveImage] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const image = realImages[activeImage] ?? realImages[0];
  const closeup = product.closeups?.[activeImage] ?? false;
  const compatibility = compatibilityNote(product, car?.donorIds);
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;
  const origin = donorLine(product);

  function moveImage(offset: number) {
    setActiveImage((index) => (index + offset + realImages.length) % realImages.length);
  }

  const buyBox = <div className="grid min-w-0 gap-2 rounded-ui bg-white p-4 shadow-card" data-buy-box>
    <p className={`text-price font-bold ${isFixedPrice ? "text-accent" : "text-ink"}`}>{priceText(product)}</p>
    {product.condition ? <p className="text-body text-ink" data-condition><b>{product.condition}</b>{facts?.conditionNote ? ` · ${facts.conditionNote}` : ""}</p> : facts?.conditionNote ? <p className="text-body text-ink" data-condition>{facts.conditionNote}</p> : null}
    {typeof product.stock === "number" && <p className={`text-body ${product.stock > 0 ? "text-success" : "text-ink-2"}`}>{product.stock > 0 ? (isFixedPrice ? `${product.stock} шт. на складе` : availabilityNote(product)) : "Нет в наличии"}</p>}
    <CartControl className="w-full" product={product} showCartLink />
    {facts ? <p className={`text-meta ${facts.returnLine.restricted ? "font-bold text-ink" : "text-ink-2"}`} data-return-line>
      {facts.returnLine.text} <Link className="text-accent underline hover:text-accent-hover" href="/returns">Условия</Link>
    </p> : null}
    <p className="text-meta text-ink-2">Стоимость и срок доставки уточнит оператор.</p>
  </div>;

  return (
    <article className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-x-8">
      <header className="min-w-0 xl:col-start-2 xl:row-start-1">
        <h1 className="break-words text-block font-bold text-ink xl:text-section">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <FavoriteButton className="h-11 w-11 rounded-ui border border-line" id={product.id} name={product.name} />
          {product.reviewCount > 0 && <a href="#reviews" className="text-meta text-ink-2 hover:text-accent">★ {product.rating.toFixed(1)} · отзывов: {product.reviewCount}</a>}
        </div>
      </header>

      <div className="min-w-0 xl:col-start-1 xl:row-span-3 xl:row-start-1">
        {image ? <>
          <div className="relative aspect-[4/3] touch-pan-y overflow-hidden rounded-ui bg-surface xl:aspect-square"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              touchStart.current = realImages.length > 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
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
            <Image alt={image.alt} className="object-contain" fill priority={activeImage === 0} sizes="(min-width: 1200px) 50vw, 100vw" src={image.url} />
            {closeup ? <span className="absolute left-2 top-2 rounded-badge bg-ink px-2 py-1 text-badge font-bold text-white" data-closeup>Крупный план дефекта</span> : null}
            {realImages.length > 1 && <>
              <button type="button" aria-label="Предыдущее фото" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-ui bg-white text-ink shadow-card" onClick={() => moveImage(-1)}><ChevronLeft aria-hidden="true" /></button>
              <button type="button" aria-label="Следующее фото" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-ui bg-white text-ink shadow-card" onClick={() => moveImage(1)}><ChevronRight aria-hidden="true" /></button>
              <span aria-live="polite" className="sr-only">Фото {activeImage + 1} из {realImages.length}</span>
            </>}
          </div>
          {realImages.length > 1 && (
            <div className="scroller-x mt-2 min-w-0 gap-2 p-1" data-scroller role="group" aria-label="Фотографии товара">
              {realImages.map((item, index) => (
                <button aria-label={`Показать фотографию ${index + 1}`} aria-pressed={activeImage === index}
                  className={`relative aspect-square w-12 shrink-0 snap-start overflow-hidden rounded-ui border xl:w-16 ${activeImage === index ? "border-accent" : "border-line"}`}
                  key={`${item.url}-${index}`} onClick={() => setActiveImage(index)} type="button">
                  <Image alt="" className="object-cover" fill sizes="64px" src={product.thumbs?.[index] || item.url} />
                </button>
              ))}
            </div>
          )}
        </> : <div className="grid aspect-[4/3] place-items-center rounded-ui bg-surface-2 p-4 text-center xl:aspect-square" data-no-photo>
          <div className="grid justify-items-center gap-3">
            <p className="text-lead font-bold text-ink">Фото пришлём в Viber</p>
            <p className="text-body text-ink-2">Своих фото этой детали ещё нет на сайте. Снимем её на складе и пришлём.</p>
            <a className="inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href={`viber://chat?number=${encodeURIComponent(messengerPhone)}`}>Написать в Viber {messengerPhoneLabel}</a>
          </div>
        </div>}
      </div>

      <div className="min-w-0 xl:col-start-2 xl:row-start-2">{buyBox}</div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:col-start-2 xl:row-start-3">
        <section>
          <h2 className="rounded-ui bg-surface-2 px-4 py-3 text-block font-bold">Характеристики</h2>
          <dl className="px-4 text-body [&>div]:grid [&>div]:grid-cols-2 [&>div]:gap-4 [&>div]:border-b [&>div]:border-line [&>div]:py-3 [&_dt]:text-ink-2 [&_dd]:min-w-0 [&_dd]:break-words" data-specs>
            <div><dt>Артикул</dt><dd>{product.sku}</dd></div>
            {product.oem && <div><dt>Номер OEM</dt><dd>{product.oem}</dd></div>}
            {product.brand && <div><dt>Бренд детали</dt><dd>{product.brand}</dd></div>}
            {product.condition && <div><dt>Состояние</dt><dd>{product.condition}</dd></div>}
            {facts?.specs.map((row) => <div data-spec={row.key} key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            {product.crossNumbers?.length ? <div data-cross><dt>Кросс-номера</dt><dd>{product.crossNumbers.map((item) => `${item.number}${item.source ? ` (${item.source})` : ""}`).join(", ")}</dd></div> : null}
            {origin && <div data-origin><dt>Снято с</dt><dd>{product.donorId ? <Link className="inline-flex min-h-11 items-center font-bold text-accent underline hover:text-accent-hover" href={`/donors/${product.donorId}`}>{origin}</Link> : origin}</dd></div>}
          </dl>
        </section>

        <section data-fitment>
          <h2 className="rounded-ui bg-surface-2 px-4 py-3 text-block font-bold">Применимость</h2>
          <div className="grid gap-2 px-4 pt-3 text-body">
            {origin ? <p className="text-ink-2">Деталь снята с машины <b className="text-ink">{origin}</b>. Это её происхождение, а не обещание, что она подойдёт на другие кузова.</p> : null}
            {facts?.fitments.length ? <ul className="grid gap-1">{facts.fitments.map((item) => <li key={item.id}>
              {[item.make, item.model, item.generation, item.yearFrom || item.yearTo ? `${item.yearFrom ?? ""}–${item.yearTo ?? ""}` : "", item.engine].filter(Boolean).join(" ")}
              {item.verified ? <span className="ml-2 text-meta font-bold text-success">проверено</span> : <span className="ml-2 text-meta text-ink-2">по номеру, не сверено</span>}
            </li>)}</ul> : null}
            {car ? <p>Ваша машина: <b>{car.label}{car.year ? ` ${car.year}` : ""}</b> · <Link className="text-accent hover:text-accent-hover" href="/#car-picker">сменить</Link></p> : null}
            {compatibility ? <p className={`text-meta ${compatibility.startsWith("Снята") ? "text-success" : "text-ink-2"}`}>{compatibility}</p> : null}
            <div className="max-w-xs"><PriceRequest className="w-full" label="Проверить, подойдёт ли" product={product} /></div>
          </div>
        </section>
      </div>

      <div aria-hidden="true" className="h-16 desktop:hidden" />
      {/* Телефон: цена и кнопка всегда под рукой, даже если пролистали к характеристикам. */}
      <div className="fixed inset-x-0 bottom-tabbar z-30 border-t border-line bg-white px-4 py-2 desktop:hidden" data-sticky-buy>
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 shrink-0 text-lead font-bold text-ink">{priceText(product)}</p>
          <div className="min-w-0 flex-1"><CartControl className="w-full" product={product} /></div>
        </div>
      </div>
    </article>
  );
}

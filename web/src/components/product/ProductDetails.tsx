"use client";

import { Check, Heart, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { Product } from "@/domain/catalog";

type ProductDetailsProps = {
  product: Product;
};

function productPrice(product: Product) {
  return product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
}

export function ProductDetails({ product }: ProductDetailsProps) {
  const images = product.images?.length ? product.images : [product.image];
  const [activeImage, setActiveImage] = useState(0);
  const [isFavourite, setIsFavourite] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isInCart, setIsInCart] = useState(false);
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;
  const image = images[activeImage] ?? images[0]!;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 rounded-ui bg-white p-4 md:p-6 desktop:grid-cols-2">
      <div className="min-w-0">
        <div className="relative aspect-square rounded-ui bg-surface-2">
          <Image alt={image.alt} className="object-contain p-4" fill priority sizes="(min-width: 1200px) 50vw, 100vw" src={image.url} />
          <button
            aria-label={isFavourite ? "Убрать из избранного" : "Добавить в избранное"}
            className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white shadow-card ${isFavourite ? "text-accent" : "text-ink-3 hover:text-accent"}`}
            onClick={() => setIsFavourite((current) => !current)}
            type="button"
          >
            <Heart fill={isFavourite ? "currentColor" : "none"} size={20} />
          </button>
        </div>
        {images.length > 1 ? (
          <div className="mt-3 flex gap-2" role="tablist">
            {images.map((item, index) => (
              <button
                aria-label={`Показать фотографию ${index + 1}`}
                aria-selected={activeImage === index}
                className={`relative h-16 w-16 rounded-ui border ${activeImage === index ? "border-accent" : "border-line"}`}
                key={item.url}
                onClick={() => setActiveImage(index)}
                role="tab"
                type="button"
              >
                <Image alt="" className="object-contain p-1" fill sizes="64px" src={item.url} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="text-meta text-ink-2">{product.brand} · {product.sku}</p>
        <h1 className="mt-2 text-block font-bold text-ink">{product.name}</h1>
        <p className="mt-3 text-meta text-ink-2">Артикул: {product.sku}</p>
        <p className={`mt-6 text-price font-bold ${isFixedPrice ? "text-accent" : "text-ink"}`}>{productPrice(product)}</p>
        <p className="mt-2 text-body text-ink-2">Доставка от 1 дня</p>
        {isFixedPrice ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div aria-label="Количество" className="flex h-10 items-center rounded-ui border border-line bg-white">
              <button aria-label="Уменьшить количество" className="grid h-full w-10 place-items-center text-ink-2 hover:text-accent" disabled={quantity === 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} type="button"><Minus size={18} /></button>
              <span className="min-w-8 text-center text-body font-bold text-ink">{quantity}</span>
              <button aria-label="Увеличить количество" className="grid h-full w-10 place-items-center text-ink-2 hover:text-accent" onClick={() => setQuantity((current) => current + 1)} type="button"><Plus size={18} /></button>
            </div>
            <button className={`flex h-btn items-center justify-center gap-2 rounded-ui px-6 text-btn font-bold ${isInCart ? "border border-accent bg-white text-accent" : "bg-accent text-white hover:bg-accent-hover"}`} onClick={() => setIsInCart((current) => !current)} type="button">
              {isInCart ? <><Check size={18} />В корзине</> : "В корзину"}
            </button>
          </div>
        ) : <button className="mt-6 h-btn w-full rounded-ui border border-accent bg-white text-btn font-bold text-accent hover:bg-surface-2" type="button">Узнать цену</button>}
        <div className="mt-6 border-t border-line pt-4 text-meta text-ink-2">Уточните совместимость с автомобилем у нашего эксперта перед оформлением заказа.</div>
      </div>
    </section>
  );
}

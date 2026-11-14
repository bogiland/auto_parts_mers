"use client";

import { CartControl } from "@/components/cart/CartControl";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import Image from "next/image";
import Link from "next/link";
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
  const isFixedPrice = product.priceMode === "fixed" && product.priceMdl;
  const image = images[activeImage] ?? images[0]!;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 rounded-ui bg-white p-4 md:p-6 desktop:grid-cols-2">
      <div className="min-w-0">
        <div className="relative aspect-square rounded-ui bg-surface-2">
          <Image alt={image.alt} className="object-contain p-4" fill priority sizes="(min-width: 1200px) 50vw, 100vw" src={image.url} />
          <FavoriteButton className="absolute right-3 top-3 h-10 w-10 rounded-ui bg-white shadow-card" id={product.id} name={product.name} />
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
        <p className="mt-2 text-body text-ink-2">Стоимость и срок доставки назовёт оператор при подтверждении.</p>
        <dl className="mt-4 flex flex-col gap-2 text-body">
          {product.condition && <div className="flex gap-2"><dt className="text-ink-2">Состояние:</dt><dd className="font-medium text-ink">{product.condition}</dd></div>}
          {typeof product.stock === "number" && <div className="flex gap-2"><dt className="text-ink-2">Наличие:</dt><dd className={product.stock > 0 ? "font-medium text-success" : "font-medium text-ink-2"}>{product.stock > 0 ? `${product.stock} шт. на складе` : "Нет в наличии"}</dd></div>}
          {product.donor && <div className="flex gap-2"><dt className="text-ink-2">Снято с машины:</dt><dd className="min-w-0 font-medium text-ink">{product.donorId ? <Link className="hover:text-accent" href={`/donors/${product.donorId}`}>{product.donor}</Link> : product.donor}</dd></div>}
        </dl>
        {product.returnRestricted && <p className="mt-4 rounded-ui bg-surface-2 p-3 text-meta text-ink">Двигатели, коробки передач и агрегаты в сборе возврату не подлежат. Осмотрите деталь при получении.</p>}
        <div className="mt-6"><CartControl className="w-full md:w-48" product={product} /></div>
        <div className="mt-6 border-t border-line pt-4 text-meta text-ink-2">Уточните совместимость с автомобилем у нашего эксперта перед оформлением заказа.</div>
      </div>
    </section>
  );
}

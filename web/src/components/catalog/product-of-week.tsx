import Image from "next/image";

import type { Product } from "@/domain/catalog";

import { ProductCarousel } from "./product-carousel";

export function ProductOfWeek({ products }: { products: Product[] }) {
  const featured = products[0];
  if (!featured) return null;

  const price = featured.priceMode === "fixed" && featured.priceMdl ? `${featured.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";

  return (
    <aside className="product-of-week" aria-label="Товар недели">
      <div className="product-of-week__desktop">
        <div className="product-of-week__heading"><h2>Товар недели</h2><span>Осталось <b>4</b> дня</span></div>
        <a aria-label={featured.name} className="product-of-week__image" href={`/products/${featured.id}`}><Image alt={featured.image.alt} fill sizes="180px" src={featured.image.url} /></a>
        <div className="product-of-week__details"><p>{featured.brand} · {featured.sku}</p><h2>{featured.name}</h2><strong>{price}</strong><button className="button button--red" type="button">В корзину</button><small>Доставка от 1 дня</small></div>
      </div>
      <div className="product-of-week__compact">
        <div className="product-of-week__heading"><h2>Товар недели</h2><span>Осталось <b>4</b> дня</span></div>
        <ProductCarousel products={products.slice(0, 5)} />
      </div>
    </aside>
  );
}

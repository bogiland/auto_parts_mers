import Image from "next/image";
import { Heart } from "lucide-react";

import type { Product } from "@/domain/catalog";

export function ProductCard({ product }: { product: Product }) {
  const price = product.priceMode === "fixed" && product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену";
  return <article className="product-card"><a aria-label={product.name} className="product-card__image" href={`/products/${product.id}`}><Image alt={product.image.alt} fill sizes="(max-width: 850px) 54vw, 17vw" src={product.image.url} /></a><button aria-label={`Добавить ${product.name} в избранное`} className="product-card__favorite" type="button"><Heart size={15} strokeWidth={1.7} /></button><div className="product-card__content"><p className="product-card__price">{price}</p><p className="product-card__brand">{product.brand} · {product.sku}</p><h3>{product.name}</h3><button className="product-card__cart" type="button">В корзину</button><p className="product-card__delivery">Доставка от 1 дня</p></div></article>;
}

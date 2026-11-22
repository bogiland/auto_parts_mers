import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/domain/catalog";
import { CartControl } from "@/components/cart/CartControl";
import { ProductRail } from "@/components/product/ProductRail";

import { HomeCarousel } from "./HomeCarousel";

export function WeeklyProducts({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return <>
    <div className="min-w-0 xl:hidden"><h2 className="mb-4 text-block font-bold text-ink">Товар недели</h2><ProductRail products={products} /></div>
    <aside className="relative hidden min-w-0 rounded-ui border border-line bg-white p-4 xl:block">
      <h2 className="text-block font-bold text-ink">Товар недели</h2>
      <div className="mt-4">
        <HomeCarousel label="Товар недели">
          {products.map((product) => <div className="flex min-w-0 items-center gap-4" key={product.id}>
            <Link className="deal-product-image relative shrink-0" href={`/products/${product.id}`}><Image alt={product.name} className="object-contain" fill sizes="140px" src={product.image.url} /></Link>
            <div className="min-w-0"><p className="text-price font-bold text-accent">{product.priceMdl ? `${product.priceMdl.toLocaleString("ru-RU")} L.` : "Уточнить цену"}</p><p className="mt-2 text-meta text-ink-2">{product.brand} · {product.sku}</p><Link className="mt-2 block text-nav font-bold text-ink" href={`/products/${product.id}`}>{product.name}</Link><div className="mt-2"><CartControl product={product} /></div><p className="mt-2 text-meta text-ink-2">В наличии · Слободзея</p></div>
          </div>)}
        </HomeCarousel>
      </div>
    </aside>
  </>;
}

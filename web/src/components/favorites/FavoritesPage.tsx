"use client";

import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/domain/catalog";
import { useFavorites } from "@/lib/favorites-store";

export function FavoritesPage({ products }: { products: Product[] }) {
  const ids = useFavorites();
  const byId = new Map(products.map((product) => [product.id, product]));
  const selected = ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));

  return <main className="container-site min-h-screen bg-surface-2 py-6 text-ink">
    <h1 className="mb-6 text-section font-bold">Избранное</h1>
    {selected.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 desktop:grid-cols-4">
      {selected.map((product) => <div className="relative min-w-0" key={product.id}>
        <ProductCard className={product.stock === 0 ? "opacity-60" : ""} product={product} />
        {product.stock === 0 ? <div className="absolute inset-x-0 bottom-0 rounded-ui bg-white p-3 shadow-card">
          <p className="mb-2 text-body font-bold text-ink-2">Продано</p>
          <Link className="block rounded-ui border border-accent px-3 py-2 text-center text-btn font-bold text-accent hover:bg-accent hover:text-white" href="/catalog/legkovye">Похожие в наличии</Link>
        </div> : null}
      </div>)}
    </div> : <div className="rounded-ui bg-white p-8 text-center">
      <p className="text-block font-bold">Нажмите ♡ на товаре, чтобы сохранить</p>
      <Link className="mt-6 inline-flex rounded-ui bg-accent px-4 py-3 text-btn font-bold text-white" href="/catalog/legkovye">Перейти в каталог</Link>
    </div>}
  </main>;
}

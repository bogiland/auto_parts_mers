"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/domain/catalog";
import { cartCount, clearCart, removeCartItem, restoreCartItem, retryCart, setCartQuantity, useCart, type CartItem } from "@/lib/cart-store";

const lei = (value: number) => `${value.toLocaleString("ru-RU")} L.`;
const rub = (value: number) => `${value.toLocaleString("ru-RU")} руб`;

export function CartPage({ products }: { products: Product[] }) {
  const cart = useCart();
  const [undone, setUndone] = useState<CartItem | null>(null);
  const byId = new Map(products.map((product) => [product.id, product]));
  const rows = cart.items.map((item) => ({ item, product: byId.get(item.id) }));
  const available = rows.filter(({ product }) => product && product.stock !== 0 && product.priceMode === "fixed" && product.priceMdl !== null);
  const count = available.reduce((total, { item, product }) => total + Math.min(item.quantity, product?.stock ?? 1), 0);
  const total = available.reduce((sum, { item, product }) => sum + (product?.priceMdl ?? 0) * Math.min(item.quantity, product?.stock ?? 1), 0);
  const hasRub = available.length > 0 && available.every(({ product }) => product?.priceRub !== undefined);
  const rubTotal = hasRub ? available.reduce((sum, { item, product }) => sum + (product?.priceRub ?? 0) * Math.min(item.quantity, product?.stock ?? 1), 0) : null;

  useEffect(() => {
    if (!undone) return;
    const timer = window.setTimeout(() => setUndone(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undone]);

  function remove(item: CartItem) { removeCartItem(item.id); setUndone(item); }
  function restore() {
    if (!undone) return;
    restoreCartItem(undone);
    setUndone(null);
  }

  return <main className="container-site min-h-screen bg-surface-2 py-6 pb-48 text-ink desktop:pb-6">
    <h1 className="mb-6 text-section font-bold">Корзина</h1>
    {!cart.loaded ? <div aria-label="Загрузка корзины" className="grid gap-4"><div className="h-32 animate-pulse rounded-ui bg-line" /><div className="h-32 animate-pulse rounded-ui bg-line" /></div> : cart.error ? <div className="rounded-ui bg-white p-6"><p className="text-body">Не удалось загрузить корзину</p><button className="mt-4 rounded-ui bg-accent px-4 py-2 text-btn font-bold text-white" onClick={retryCart} type="button">Повторить</button></div> : !rows.length ? <div className="rounded-ui bg-white p-8 text-center"><p className="text-block font-bold">В корзине пока пусто</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="rounded-ui bg-accent px-4 py-3 text-btn font-bold text-white" href="/catalog/legkovye">Перейти в каталог</Link><Link className="rounded-ui border border-accent px-4 py-3 text-btn font-bold text-accent" href="/#expert-request">Не нашли деталь? Оставьте заявку</Link></div></div> : <div className="grid gap-6 desktop:grid-cols-3">
      <div className="min-w-0 space-y-3 desktop:col-span-2">
        <div className="flex items-center justify-between"><p className="text-body text-ink-2">{cartCount(cart)} шт. в корзине</p><button className="text-body text-ink-2 hover:text-accent" onClick={() => { clearCart(); setUndone(null); }} type="button">Очистить корзину</button></div>
        {rows.map(({ item, product }) => {
          const sold = !product || product.stock === 0;
          const max = product?.stock ?? 1;
          const quantity = Math.min(item.quantity, max);
          return <article className={`rounded-ui bg-white p-4 ${sold ? "opacity-60" : ""}`} key={item.id}>
            <div className="flex gap-3 md:gap-4">
              <div className="cart-product-image relative shrink-0 rounded-ui bg-white">{product ? <Image alt={product.image.alt} className="object-contain" fill sizes="(min-width: 768px) 96px, 72px" src={product.image.url} /> : null}</div>
              <div className="min-w-0 flex-1">
                {sold ? <span className="rounded-badge bg-surface-2 px-2 py-1 text-badge font-bold text-ink-2">Продано</span> : null}
                {product ? <Link className="block text-body font-bold hover:text-accent" href={`/products/${product.id}`}>{product.name}</Link> : <span className="text-body font-bold">Товар больше недоступен</span>}
                {product ? <p className="mt-1 text-meta text-ink-2">{product.condition ?? "Состояние уточнит оператор"} · OEM {product.sku}</p> : null}
                {product?.donor ? <p className="mt-1 text-meta text-ink-2">Донор: {product.donor}</p> : null}
                {!sold ? <p className="mt-2 text-meta text-success">В наличии{product.stock !== undefined ? `, ${product.stock} шт.` : " — уточнит оператор"}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {!sold && product?.priceMdl !== null ? <><strong className="text-price">{lei((product?.priceMdl ?? 0) * quantity)}</strong>{product?.priceRub !== undefined ? <span className="text-meta text-ink-2">≈ {rub(product.priceRub * quantity)}</span> : null}</> : null}
                <button aria-label={`Удалить ${product?.name ?? "товар"}`} className="text-ink-2 hover:text-accent" onClick={() => remove(item)} type="button"><Trash2 size={18} /></button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              {sold ? <Link className="text-body font-bold text-accent" href="/catalog/legkovye">Найти похожий</Link> : max > 1 && product ? <div aria-label="Количество" className="flex h-9 items-center rounded-ui border border-line text-body"><button aria-label="Уменьшить количество" className="grid h-9 w-9 place-items-center disabled:text-ink-3" disabled={quantity <= 1} onClick={() => setCartQuantity(product, quantity - 1)} type="button"><Minus size={16} /></button><span className="min-w-8 text-center">{quantity}</span><button aria-label="Увеличить количество" className="grid h-9 w-9 place-items-center disabled:text-ink-3" disabled={quantity >= max} onClick={() => setCartQuantity(product, quantity + 1)} title={quantity >= max ? "Больше нет в наличии" : undefined} type="button"><Plus size={16} /></button></div> : <span className="text-body">1 шт.</span>}
              {product?.stock !== undefined && item.quantity > max && !sold ? <span className="text-meta text-accent">Осталось {max} шт.</span> : null}
            </div>
          </article>;
        })}
      </div>
      <aside className="fixed inset-x-0 bottom-tabbar z-40 self-start border border-line bg-white p-4 shadow-card desktop:sticky desktop:top-6 desktop:bottom-auto desktop:rounded-ui desktop:shadow-none">
        <div className="flex justify-between gap-3 text-body"><span>Товары ({count})</span><span>{lei(total)}{rubTotal !== null ? <span className="block text-right text-meta text-ink-2">≈ {rub(rubTotal)}</span> : null}</span></div>
        <div className="mt-4 flex justify-between gap-3 text-body"><span>Доставка</span><span className="text-right text-ink-2">Уточнит оператор</span></div>
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-price font-bold"><span>Итого</span><span>{lei(total)}</span></div>
        <Link aria-disabled={!count} className={`mt-4 flex h-control w-full items-center justify-center rounded-ui bg-accent text-btn font-bold text-white ${!count ? "pointer-events-none opacity-50" : ""}`} href="/checkout">Оформить заказ</Link>
        <p className="mt-2 text-center text-meta text-ink-2">Оператор подтвердит наличие и доставку с 8:00 до 20:00</p>
      </aside>
    </div>}
    {undone ? <div className="fixed bottom-20 left-4 z-50 flex items-center gap-4 rounded-ui bg-header-dark px-4 py-3 text-body text-white shadow-card desktop:bottom-6" role="status"><span>Удалено</span><button className="font-bold text-white underline" onClick={restore} type="button">Вернуть</button></div> : null}
  </main>;
}

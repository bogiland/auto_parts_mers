"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/domain/catalog";
import { PriceRequest } from "@/components/forms/PriceRequest";
import { cartQuantity, setCartQuantity, useCart } from "@/lib/cart-store";

export function CartControl({ product, className = "" }: { product: Product; className?: string }) {
  const cart = useCart();
  const quantity = cartQuantity(cart, product.id);
  const available = product.stock ?? 1;
  if (product.priceMode === "on_request" || product.priceMdl === null) {
    // Цены нет — заявка оператору с уже подставленной деталью, прямо на месте.
    return <PriceRequest className={className} product={product} />;
  }
  if (product.stock === 0) return <PriceRequest className={className} label="Узнать наличие" product={product} />;
  if (quantity === 0) return <button className={`h-9 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover ${className}`} onClick={() => setCartQuantity(product, 1)} type="button">В корзину</button>;
  return <div aria-label="Количество в корзине" className={`flex h-9 items-center justify-between rounded-ui border border-accent text-body text-accent ${className}`}>
    <button aria-label={`Удалить ${product.name} из корзины`} className="grid h-full w-10 place-items-center" onClick={() => setCartQuantity(product, 0)} type="button"><Trash2 size={17} /></button>
    <Link className="font-bold" href="/cart">{quantity}</Link>
    <button aria-label={`Добавить ещё ${product.name}`} className="grid h-full w-10 place-items-center disabled:text-ink-3" disabled={quantity >= available} onClick={() => setCartQuantity(product, quantity + 1)} title={quantity >= available ? "Больше нет в наличии" : undefined} type="button"><Plus size={18} /></button>
  </div>;
}

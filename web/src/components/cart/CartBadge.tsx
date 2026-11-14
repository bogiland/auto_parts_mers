"use client";

import { cartCount, useCart } from "@/lib/cart-store";

export function CartBadge({ mobile = false }: { mobile?: boolean }) {
  const count = cartCount(useCart());
  if (!count) return null;
  return <span className={mobile ? "absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-badge bg-accent px-1 text-badge font-bold text-white" : "absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-badge font-bold text-white"}>{count}</span>;
}

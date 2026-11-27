"use client";

import { Heart, House, LogIn, ShoppingCart, TableCellsMerge } from "lucide-react";
import Link from "next/link";
import { CartBadge } from "@/components/cart/CartBadge";
import { FavoritesBadge } from "@/components/favorites/FavoritesBadge";
import { usePathname } from "next/navigation";

const base = [
  ["Главная", "/", House],
  ["Каталог", "/catalog/legkovye", TableCellsMerge],
  ["Корзина", "/cart", ShoppingCart],
  ["Избранное", "/favorites", Heart],
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function MobileTabBar({ account }: { account: { label: string; href: string } }) {
  const pathname = usePathname();
  const items = [...base, [account.label, account.href, LogIn]] as const;
  // На шаге оформления нижнее меню не нужно: оно отвлекает и закрывает кнопку «Подтвердить заказ».
  if (pathname.startsWith("/checkout")) return null;

  return (
    <nav aria-label="Быстрая навигация" className="fixed inset-x-0 bottom-0 z-50 flex h-tabbar border-t border-line bg-white pb-[env(safe-area-inset-bottom)] desktop:hidden">
      {items.map(([label, href, Icon]) => {
        const active = isActive(pathname, href);
        return <Link className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-meta font-medium ${active ? "text-accent" : "text-ink-2"}`} href={href} key={href}><span className="relative"><Icon aria-hidden="true" size={24} strokeWidth={1.8} />{label === "Корзина" ? <CartBadge mobile /> : null}{label === "Избранное" ? <FavoritesBadge mobile /> : null}</span><span>{label}</span></Link>;
      })}
    </nav>
  );
}

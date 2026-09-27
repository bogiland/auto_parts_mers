"use client";

import { Heart, House, LogIn, ShoppingCart, TableCellsMerge } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Главная", "/", House],
  ["Каталог", "/catalog/legkovye", TableCellsMerge],
  ["Корзина", "/cart", ShoppingCart],
  ["Избранное", "/favorites", Heart],
  ["Войти", "/account", LogIn],
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Быстрая навигация" className="fixed inset-x-0 bottom-0 z-50 flex h-tabbar border-t border-line bg-white pb-[env(safe-area-inset-bottom)] desktop:hidden">
      {items.map(([label, href, Icon]) => {
        const active = isActive(pathname, href);
        return <Link className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-meta font-medium ${active ? "text-accent" : "text-ink-2"}`} href={href} key={href}><span className="relative"><Icon aria-hidden="true" size={24} strokeWidth={1.8} />{label === "Корзина" ? <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-badge bg-accent text-badge font-bold text-white">0</span> : null}</span><span>{label}</span></Link>;
      })}
    </nav>
  );
}

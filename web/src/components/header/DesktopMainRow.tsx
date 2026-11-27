import { Heart, ShoppingCart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { CartBadge } from "@/components/cart/CartBadge";
import { FavoritesBadge } from "@/components/favorites/FavoritesBadge";
import { SearchBox, SearchBoxFallback } from "@/components/search/SearchBox";

import { CatalogButton } from "./CatalogButton";
import type { PublicCategory } from "@/lib/reference-db";

interface DesktopMainRowProps {
  hours: string;
  categories: PublicCategory[];
  account: { label: string; href: string };
}

function HeaderAction({ href, icon, label, badge = false, favorites = false }: { href: string; icon: ReactNode; label: string; badge?: boolean; favorites?: boolean }) {
  return (
    <Link aria-label={label} className="header-action flex shrink-0 flex-col items-center gap-1 text-meta font-medium text-white hover:text-accent" href={href}>
      <span className="relative">
        {icon}
        {badge ? <CartBadge /> : null}
        {favorites ? <FavoritesBadge /> : null}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function DesktopMainRow({ hours, account, categories }: DesktopMainRowProps) {
  return (
    <div className="header-desktop-row bg-header">
      <div className="container-site flex h-full min-w-0 items-center gap-4 py-3">
        <Link aria-label="NAA.md, главная" className="header-logo-slot shrink-0" href="/">
          <span className="relative block h-6 w-40 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} priority src="/images/brand/naa-logo-transparent.png" width={863} /></span>
        </Link>
        <CatalogButton categories={categories} />
        <div className="header-desktop-search flex min-w-0 flex-1"><Suspense fallback={<SearchBoxFallback />}><SearchBox /></Suspense></div>
        <div className="ml-auto flex shrink-0 items-start gap-2">
          <HeaderAction href={account.href} icon={<UserRound aria-hidden="true" size={24} strokeWidth={1.8} />} label={account.label} />
          <HeaderAction href="/favorites" icon={<Heart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Избранное" favorites />
          <HeaderAction badge href="/cart" icon={<ShoppingCart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Корзина" />
        </div>
        <span className="sr-only">График работы: {hours}</span>
      </div>
    </div>
  );
}

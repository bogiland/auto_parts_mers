"use client";

import { Heart, ShoppingCart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { SearchBox, SearchBoxFallback } from "@/components/search/SearchBox";

import { CatalogButton } from "./CatalogButton";

interface DesktopMainRowProps {
  hours: string;
}

function HeaderAction({ href, icon, label, badge = false }: { href: string; icon: ReactNode; label: string; badge?: boolean }) {
  return (
    <Link aria-label={label} className="header-action flex shrink-0 flex-col items-center gap-1 text-meta font-medium text-white hover:text-accent" href={href}>
      <span className="relative">
        {icon}
        {badge ? <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-badge font-bold text-white">0</span> : null}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function DesktopMainRow({ hours }: DesktopMainRowProps) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const updatePinnedState = () => setIsPinned(window.scrollY > 120);
    updatePinnedState();
    window.addEventListener("scroll", updatePinnedState, { passive: true });
    return () => window.removeEventListener("scroll", updatePinnedState);
  }, []);

  return (
    <>
      {isPinned ? <div aria-hidden="true" className="header-desktop-row-spacer header-desktop-row-spacer--pinned" /> : null}
      <div className={`header-desktop-row bg-header transition-shadow ${isPinned ? "header-desktop-row--pinned" : ""}`}>
        <div className={`container-site flex h-full min-w-0 items-center gap-4 ${isPinned ? "py-2" : "py-3"}`}>
          <Link aria-label="NAA.md, главная" className="header-logo-slot shrink-0" href="/">
            <Image alt="NAA.md" className="h-9 w-full object-contain object-left" height={36} priority src="/images/brand/naa-logo.png" width={160} />
          </Link>
          <CatalogButton />
          <div className="header-desktop-search flex min-w-0 flex-1"><Suspense fallback={<SearchBoxFallback />}><SearchBox /></Suspense></div>
          <div className="ml-auto flex shrink-0 items-start gap-2">
            <HeaderAction href="/account" icon={<UserRound aria-hidden="true" size={24} strokeWidth={1.8} />} label="Войти" />
            <HeaderAction href="/favorites" icon={<Heart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Избранное" />
            <HeaderAction badge href="/cart" icon={<ShoppingCart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Корзина" />
          </div>
          <span className="sr-only">График работы: {hours}</span>
        </div>
      </div>
    </>
  );
}

"use client";

import { ChevronRight, type LucideIcon, Battery, CircleDot, Cog, Disc3, Grid2X2, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { categoryTabs, homeCategories, type HomeCategoryTab } from "@/lib/data/home-categories";

const icons: Record<string, LucideIcon> = { Battery, CircleDot, Cog, Disc3, Grid2X2, Wrench };
const categoriesWithoutImages = homeCategories.filter((category) => !category.image);

export function CategoryTabs() {
  const [activeTab, setActiveTab] = useState<HomeCategoryTab>("popular");
  const [hasOverflow, setHasOverflow] = useState(false);
  const tabListRef = useRef<HTMLDivElement>(null);
  const categories = homeCategories.filter((category) => category.tab === activeTab);

  useEffect(() => {
    if (categoriesWithoutImages.length) console.info("TODO: категории без изображений", categoriesWithoutImages.map((category) => category.title));

    const updateOverflow = () => setHasOverflow((tabListRef.current?.scrollWidth ?? 0) > (tabListRef.current?.clientWidth ?? 0));
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, []);

  function showNextTabs() {
    tabListRef.current?.scrollBy({ behavior: "smooth", left: tabListRef.current.clientWidth / 2 });
  }

  return (
    <section aria-labelledby="popular-categories-title" className="min-w-0">
      <h2 className="sr-only" id="popular-categories-title">Популярные категории</h2>
      <div className="relative min-w-0">
        <div className="scroller-x min-w-0 items-stretch gap-0 border-b border-line" ref={tabListRef} role="tablist" aria-label="Категории запчастей">
          {categoryTabs.map((tab) => {
            const TabIcon = icons[tab.icon];
            const isActive = activeTab === tab.id;

            return <button aria-selected={isActive} className={`relative flex h-12 items-center gap-2 px-4 text-lead font-bold whitespace-nowrap ${isActive ? "text-accent after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-accent" : "text-ink-2 hover:text-ink"}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button"><TabIcon aria-hidden="true" size={20} strokeWidth={1.8} />{tab.label}</button>;
          })}
        </div>
        {hasOverflow ? <button aria-label="Показать следующие категории" className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card desktop:grid" onClick={showNextTabs} type="button"><ChevronRight size={20} /></button> : null}
      </div>
      <div className="mt-6 grid min-w-0 grid-cols-3 gap-x-4 gap-y-6 md:grid-cols-4 desktop:grid-cols-6">
        {categories.map((category) => (
          <Link className="group flex min-w-0 flex-col items-center" href={category.href} key={category.id}>
            {category.image ? <div className="category-tile-image relative shrink-0"><Image alt={category.imageAlt} className="object-contain transition-transform group-hover:scale-105" fill sizes="(min-width: 1200px) 120px, 96px" src={category.image} /></div> : (
              // TODO: replace this neutral tile after the category image is supplied.
              <div aria-label={`Изображение для категории «${category.title}» пока не добавлено`} className="category-tile-image shrink-0 rounded-ui bg-surface-2" role="img" />
            )}
            <p className="mt-2 line-clamp-2 text-center text-nav font-bold text-ink transition-colors group-hover:text-accent">{category.title}</p>
          </Link>
        ))}
      </div>
      <div className="mt-4 text-center"><Link className="text-body text-ink underline hover:text-accent" href="/catalog/legkovye">Перейти в каталог</Link></div>
    </section>
  );
}

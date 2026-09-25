"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Armchair, ArrowRightLeft, Battery, Bolt, Cable, Camera, CarFront, CircleDot, CircleGauge, CircuitBoard, Cog, Cpu, Disc3, Fan, Filter, Frame, Fuel, Gauge, GitBranch, Grid2X2, Layers, Lightbulb, Link as LinkIcon, MoveVertical, Power, RotateCw, Settings2, ShieldCheck, Sparkles, ToggleLeft, Volume2, Waves, Wind, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { categoryTabs, homeCategories, type HomeCategoryTab } from "@/lib/data/home-categories";

const icons: Record<string, LucideIcon> = {
  Armchair, ArrowRightLeft, Battery, Bolt, Cable, Camera, CarFront, CircleDot, CircleGauge, CircuitBoard, Cog, Cpu, Disc3, Fan, Filter, Frame, Fuel, Gauge, GitBranch, Grid2X2, Layers, Lightbulb, Link: LinkIcon, MoveVertical, Power, RotateCw, Settings2, ShieldCheck, Sparkles, ToggleLeft, Volume2, Waves, Wind, Wrench, Zap,
};

export function CategoryTabs() {
  const [activeTab, setActiveTab] = useState<HomeCategoryTab>("popular");
  const categories = homeCategories.filter((category) => category.tab === activeTab);

  return (
    <section aria-labelledby="popular-categories-title" className="min-w-0">
      <h2 className="sr-only" id="popular-categories-title">Популярные категории</h2>
      <div className="scroller-x min-w-0 items-stretch gap-0 border-b border-line" role="tablist" aria-label="Категории запчастей">
        {categoryTabs.map((tab) => {
          const TabIcon = icons[tab.icon];
          const isActive = activeTab === tab.id;

          return <button aria-selected={isActive} className={`relative flex h-12 items-center gap-2 px-4 text-tab font-bold whitespace-nowrap ${isActive ? "text-accent after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-accent" : "text-muted-2 hover:text-ink"}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button"><TabIcon aria-hidden="true" size={20} strokeWidth={1.8} />{tab.label}</button>;
        })}
      </div>
      <div className="mt-6 grid min-w-0 grid-cols-3 gap-2 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {categories.map((category) => {
          const CategoryIcon = icons[category.icon];

          return <Link className="group min-w-0 rounded-ui p-1 transition-colors hover:bg-surface-2" href={category.href} key={category.id}>
            <div className="relative aspect-[16/9] min-w-0">
              {category.image ? <Image alt={category.imageAlt} fill sizes="(max-width: 991px) 30vw, (max-width: 1199px) 18vw, 15vw" src={category.image} className="object-contain" /> : <CategoryIcon aria-hidden="true" className="absolute inset-0 m-auto text-muted-2" size={40} strokeWidth={1.5} />}
            </div>
            <p className="mt-2 line-clamp-2 text-center text-body font-bold text-ink">{category.title}</p>
          </Link>;
        })}
      </div>
      <div className="mt-4 text-center"><Link className="text-body text-ink underline hover:text-accent" href="/catalog/legkovye">Перейти в каталог</Link></div>
    </section>
  );
}

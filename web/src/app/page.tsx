import Link from "next/link";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { ExpertMatchTabs } from "@/components/home/ExpertMatchTabs";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { HomeCarPicker } from "@/components/home/HomeCarPicker";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeader } from "@/components/ui/section-header";
import { getLiveHomepage, ownCategoryGroups } from "@/lib/live-catalog";
import { showroomVehicles } from "@/lib/vehicles-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Главная (П9). Раньше «Товар недели», «Популярные» и «Самые просматриваемые» показывали
 * одни и те же 8 товаров, а «Популярные бренды» — логотипы Stellox и Areol, которых нет на складе.
 * Теперь два блока с разным содержимым — свежие поступления со склада и новые расходники —
 * и марки машин на разборке со ссылками на их детали.
 */
export default async function HomePage() {
  // Блок категорий строится из того же справочника, что меню и фильтры каталога.
  const [homepage, makes, ownGroups] = await Promise.all([getLiveHomepage(), showroomVehicles(), ownCategoryGroups()]);
  // Подбор строится от того же справочника машин, что меню и каталог.
  const pickerMakes = makes.map((make) => ({ slug: make.slug, name: make.name, inStock: make.inStock, models: make.models.map((model) => ({ slug: model.slug, name: model.name, inStock: model.inStock, generations: model.generations.map(({ slug, name, inStock }) => ({ slug, name, inStock })) })) }));
  // Свежие поступления — б/у детали со склада, новые первыми. Расходники — новые детали. Пересечений нет.
  const fresh = (homepage.liveProducts ?? []).filter((product) => (product.stock ?? 0) > 0 && product.conditionId !== "new").slice(0, 12);
  const consumables = (homepage.liveProducts ?? []).filter((product) => (product.stock ?? 0) > 0 && product.conditionId === "new").slice(0, 12);
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <main className="container-site section-stack">
      {/* Подбор по машине — первым экраном, рядом с поиском по номеру. */}
      <HomeCarPicker makes={pickerMakes} />
      <HeroSlider slides={homepage.heroSlides} />
      {fresh.length ? <section className="min-w-0" data-home-fresh><SectionHeader href="/catalog/legkovye/all" linkText="Все запчасти" title="Новые поступления на склад" /><ProductRail products={fresh} /></section> : null}
      <ExpertMatchTabs />
      <CategoryTabs own={ownGroups} />
      {consumables.length ? <section className="min-w-0" data-home-consumables><SectionHeader href="/catalog/legkovye/demo-filters" linkText="Фильтры и расходники" title="Новые расходники" /><ProductRail products={consumables} /></section> : null}
      {makes.length ? <section className="min-w-0" data-home-makes>
        <SectionHeader href="/catalog/legkovye/brands" linkText="Все марки" title="Машины на разборке" />
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {makes.map((make) => <Link className="flex min-h-11 flex-col justify-center rounded-ui bg-surface-2 p-3 text-body font-bold text-ink hover:text-accent" href={`/catalog/legkovye/${make.slug}`} key={make.slug}>{make.name}<span className="text-meta font-normal text-ink-2">{make.inStock} в наличии</span></Link>)}
        </div>
      </section> : null}
    </main>
    <SiteFooter />
  </>;
}

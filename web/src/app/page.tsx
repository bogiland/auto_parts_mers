import Image from "next/image";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { ExpertMatchTabs } from "@/components/home/ExpertMatchTabs";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { ProductRail } from "@/components/product/ProductRail";
import { MostViewedSection } from "@/components/catalog/most-viewed-section";
import { WeeklyProducts } from "@/components/home/WeeklyProducts";
import { SectionHeader } from "@/components/ui/section-header";
import { getLiveHomepage, ownCategoryGroups } from "@/lib/live-catalog";
import { HomeCarPicker } from "@/components/home/HomeCarPicker";
import { showroomVehicles } from "@/lib/vehicles-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Блок категорий строится из того же справочника, что меню и фильтры каталога.
  const [homepage, makes, ownGroups] = await Promise.all([getLiveHomepage({ includeInventory: false }), showroomVehicles(), ownCategoryGroups()]);
  // Подбор строится от того же справочника машин, что меню и каталог.
  const pickerMakes = makes.map((make) => ({ slug: make.slug, name: make.name, inStock: make.inStock, models: make.models.map((model) => ({ slug: model.slug, name: model.name, inStock: model.inStock, generations: model.generations.map(({ slug, name, inStock }) => ({ slug, name, inStock })) })) }));
  const order = ["air-filter-om654", "battery-agm", "brake-kit", "cabin-filter", "disc-w205", "filter-om654", "plugs-m274", "oil-5w30"];
  const ordered = order.flatMap(id => { const product = homepage.popularProducts.find(item => item.id === id); return product ? [product] : []; });
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <main className="container-site section-stack">
      {/* Подбор по машине — первым экраном, рядом с поиском по номеру, а не во второй вкладке под «Сомневаетесь…». */}
      <HomeCarPicker makes={pickerMakes} />
      <section className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2"><HeroSlider slides={homepage.heroSlides.filter(slide => slide.isEnabled)} /></div>
        <WeeklyProducts products={ordered} />
      </section>
      <ExpertMatchTabs />
      <CategoryTabs own={ownGroups} />
      <section className="min-w-0"><SectionHeader href="/catalog/legkovye" linkText="Смотреть все товары" title="Популярные товары" /><ProductRail products={[...ordered, ...homepage.popularProducts.filter(product => !order.includes(product.id))]} /></section>
      <MostViewedSection products={ordered} />
      <section className="min-w-0"><SectionHeader title="Популярные бренды" /><div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{["stellox", "areol", "furo", "chemipro", "comma", "zent-parts", "edcon", "wezer", "brix", "sk-zic"].map(brand => <div className="relative aspect-[3/1] min-w-0 overflow-hidden rounded-ui bg-surface-2" key={brand}><Image alt={brand} className="object-contain" fill sizes="(min-width: 1200px) 20vw, 40vw" src={`/images/brands/${brand}.png`} /></div>)}</div></section>
    </main>
    <SiteFooter />
  </>;
}

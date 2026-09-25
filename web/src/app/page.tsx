import { MostViewedSection } from "@/components/catalog/most-viewed-section";
import { SiteHeader } from "@/components/header/SiteHeader";
import { DealOfWeek } from "@/components/home/DealOfWeek";
import { BrandRail } from "@/components/home/BrandRail";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { ExpertMatchTabs } from "@/components/home/ExpertMatchTabs";
import { HeroSlider } from "@/components/home/HeroSlider";
import { PromoRail } from "@/components/home/PromoRail";
import { ProductRail } from "@/components/product/ProductRail";
import { SiteFooter } from "@/components/layout/site-footer";
import { SectionHeader } from "@/components/ui/section-header";
import { getHomepage } from "@/lib/catalog-gateway";

export default async function HomePage() {
  const homepage = await getHomepage();

  return (
    <>
      <SiteHeader hours={homepage.hours} phone={homepage.phone} />
      <main className="container-site section-stack pt-4 xl:pt-6 pb-12">
        <section aria-label="Подбор запчастей" className="grid min-w-0 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2"><HeroSlider slides={homepage.heroSlides} /></div>
          <DealOfWeek products={homepage.popularProducts} />
        </section>
        <ExpertMatchTabs />
        <CategoryTabs />
        <section aria-label="Сервисы NAA.md"><PromoRail /></section>
        <section className="popular-products">
          <SectionHeader href="/catalog/legkovye" linkText="Смотреть все товары" title="Популярные товары" />
          <ProductRail products={homepage.popularProducts.slice(0, 9)} />
        </section>
        <MostViewedSection products={[...homepage.popularProducts, ...homepage.popularProducts].slice(0, 8)} />
        <BrandRail />
      </main>
      <SiteFooter />
    </>
  );
}

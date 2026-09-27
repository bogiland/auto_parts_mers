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
      <main className="container-site section-stack">
        <section aria-label="Подбор запчастей" className="hero-layout min-w-0 flex flex-col gap-4 desktop:flex-row">
          <div className="hero-banner-column min-w-0"><HeroSlider slides={homepage.heroSlides} /></div>
          <div className="deal-week-column min-w-0"><DealOfWeek products={homepage.popularProducts} /></div>
        </section>
        <ExpertMatchTabs />
        <CategoryTabs />
        <section className="popular-products">
          <SectionHeader href="/catalog/legkovye" linkText="Смотреть все товары" title="Популярные товары" />
          <ProductRail products={homepage.popularProducts.slice(0, 9)} />
        </section>
        <MostViewedSection products={[...homepage.popularProducts, ...homepage.popularProducts].slice(0, 8)} />
        <BrandRail />
        <section aria-label="Сервисы NAA.md"><PromoRail /></section>
      </main>
      <SiteFooter />
    </>
  );
}

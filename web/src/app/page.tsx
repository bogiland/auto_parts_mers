import { MostViewedSection } from "@/components/catalog/most-viewed-section";
import { PostCard } from "@/components/catalog/post-card";
import { ProductCarousel } from "@/components/catalog/product-carousel";
import { PromoBanner } from "@/components/catalog/promo-banner";
import { SiteHeader } from "@/components/header/SiteHeader";
import { DealOfWeek } from "@/components/home/DealOfWeek";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { ExpertMatchTabs } from "@/components/home/ExpertMatchTabs";
import { HeroSlider } from "@/components/home/HeroSlider";
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
        <section className="promo-section" aria-label="Сервисы NAA.md">
          <div className="promo-grid">
            <PromoBanner alt="Автосервис NAA.md" href="/autoservice" image="/images/banners/autoservice-banner.png" />
            <PromoBanner alt="Запчасти и расходники для Mercedes-Benz" eyebrow="Запчасти в наличии" href="/catalog/legkovye" image="/images/hero/mercedes-powertrain-parts.png" title="Расходники для Mercedes" />
          </div>
        </section>
        <section className="popular-products">
          <SectionHeader href="/catalog/legkovye" linkText="Смотреть все товары" title="Популярные товары" />
          <ProductCarousel products={homepage.popularProducts.slice(0, 9)} />
        </section>
        <MostViewedSection products={[...homepage.popularProducts, ...homepage.popularProducts].slice(0, 8)} />
        <section className="posts">
          <SectionHeader href="/media" linkText="Смотреть все" title="Наши посты" />
          <div className="post-grid scroller-x" data-scroller>{homepage.posts.slice(0, 4).map((post) => <PostCard post={post} key={post.id} />)}</div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

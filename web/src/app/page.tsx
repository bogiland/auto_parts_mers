import { ArrowRight } from "lucide-react";

import { BenefitStrip } from "@/components/catalog/benefit-strip";
import { CategoryCard } from "@/components/catalog/category-card";
import { HeroCarousel } from "@/components/catalog/hero-carousel";
import { PostCard } from "@/components/catalog/post-card";
import { ProductCarousel } from "@/components/catalog/product-carousel";
import { PromoBanner } from "@/components/catalog/promo-banner";
import { ExpertRequestForm } from "@/components/forms/expert-request-form";
import { SecondaryNav } from "@/components/layout/secondary-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getHomepage } from "@/lib/catalog-gateway";

export default async function HomePage() {
  const homepage = await getHomepage();

  return (
    <>
      <SiteHeader hours={homepage.hours} phone={homepage.phone} />
      <SecondaryNav />
      <main className="page-shell home-page">
        <div className="home-page__layout">
          <div className="home-page__main">
            <HeroCarousel slides={homepage.heroSlides} />
            <BenefitStrip />
            <section className="popular-categories" aria-labelledby="popular-title">
              <div className="section-heading"><h2 id="popular-title">Популярные категории</h2><a href="/catalog">Все категории <ArrowRight size={17} /></a></div>
              <div className="category-grid">{homepage.categories.map((category) => <CategoryCard category={category} key={category.id} />)}</div>
            </section>
            <section className="popular-products" aria-labelledby="products-title">
              <div className="section-heading"><h2 id="products-title">Популярные товары</h2><a href="/catalog">Смотреть все товары <ArrowRight size={17} /></a></div>
              <ProductCarousel products={homepage.popularProducts} />
            </section>
            <ExpertRequestForm />
            <section className="recommendations" aria-labelledby="recommendations-title">
              <div className="section-heading"><h2 id="recommendations-title">Рекомендуем</h2><a href="/catalog">Смотреть все <ArrowRight size={17} /></a></div>
              <ProductCarousel products={homepage.recommendedProducts} />
              <div className="promo-grid">
                <PromoBanner alt="Подбор запчастей по VIN" href="/vin" image="/images/banners/vin-selection-banner.png" />
                <PromoBanner alt="Автосервис NAA.md" href="/autoservice" image="/images/banners/autoservice-banner.png" />
              </div>
            </section>
            <section className="posts" aria-labelledby="posts-title">
              <div className="section-heading"><h2 id="posts-title">Наши посты</h2><a href="/media">Смотреть все <ArrowRight size={17} /></a></div>
              <div className="post-grid">{homepage.posts.slice(0, 4).map((post) => <PostCard post={post} key={post.id} />)}</div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

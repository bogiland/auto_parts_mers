import type { HeroSlide, Product } from "@/domain/catalog";

import { HeroCarousel } from "./hero-carousel";
import { ProductOfWeek } from "./product-of-week";

export function HomeHero({ products, slides }: { products: Product[]; slides: HeroSlide[] }) {
  return (
    <section className="home-hero" aria-label="Подбор запчастей">
      <HeroCarousel slides={slides} />
      <ProductOfWeek products={products} />
    </section>
  );
}

import type { HeroSlide } from "@/domain/catalog";

import { HomeCarousel } from "./HomeCarousel";
import { PromoBanner, type PromoBannerImages } from "./PromoBanner";

const fallbackImages: PromoBannerImages[] = [
  { desktop: "/banners/hero-1-desktop.jpg", tablet: "/banners/hero-1-tablet.jpg", mobile: "/banners/hero-1-mobile.jpg" },
  { desktop: "/banners/hero-2-desktop.jpg", tablet: "/banners/hero-2-tablet.jpg", mobile: "/banners/hero-2-mobile.jpg" },
];

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  return (
    <HomeCarousel autoplay label="Предложения NAA.md">
      {slides.map((slide, index) => <PromoBanner alt={slide.image.alt} href={slide.ctaHref} images={fallbackImages[index % fallbackImages.length]!} key={slide.id} priority={index === 0} />)}
    </HomeCarousel>
  );
}

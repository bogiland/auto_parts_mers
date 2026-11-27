import type { HeroSlide } from "@/domain/catalog";

import { HomeCarousel } from "./HomeCarousel";
import { PromoBanner, type PromoBannerImages } from "./PromoBanner";

const fallbackImages: PromoBannerImages[] = [
  { desktop: "/banners/hero-1-desktop.jpg", tablet: "/banners/hero-1-tablet.jpg", mobile: "/banners/hero-1-mobile.jpg" },
  { desktop: "/banners/hero-2-desktop.jpg", tablet: "/banners/hero-2-tablet.jpg", mobile: "/banners/hero-2-mobile.jpg" },
];

/** Слайд показывается, только если у него есть картинка, текст и кнопка. Пустой баннер на первый экран не попадает. */
export function completeSlides(slides: HeroSlide[]) {
  return slides.filter((slide) => slide.isEnabled && slide.image.url && slide.title.trim() && slide.ctaLabel.trim() && slide.ctaHref.trim());
}

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const ready = completeSlides(slides);
  if (!ready.length) return null;
  return (
    <HomeCarousel autoplay label="Предложения NAA.md">
      {ready.map((slide, index) => <PromoBanner alt={slide.image.alt} ctaLabel={slide.ctaLabel} href={slide.ctaHref} images={fallbackImages[index % fallbackImages.length]!} key={slide.id} priority={index === 0} subtitle={slide.subtitle} title={slide.title} />)}
    </HomeCarousel>
  );
}

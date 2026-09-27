"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { HeroSlide } from "@/domain/catalog";

import { PromoBanner, type PromoBannerImages } from "./PromoBanner";

const fallbackImages: PromoBannerImages[] = [
  { desktop: "/banners/hero-1-desktop.jpg", tablet: "/banners/hero-1-tablet.jpg", mobile: "/banners/hero-1-mobile.jpg" },
  { desktop: "/banners/hero-2-desktop.jpg", tablet: "/banners/hero-2-tablet.jpg", mobile: "/banners/hero-2-mobile.jpg" },
];

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  function goToSlide(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ behavior: "smooth", left: viewport.clientWidth * index });
    setCurrentIndex(index);
  }

  useEffect(() => {
    if (isPaused || slides.length < 2) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        const nextIndex = (index + 1) % slides.length;
        viewportRef.current?.scrollTo({ behavior: "smooth", left: (viewportRef.current?.clientWidth ?? 0) * nextIndex });
        return nextIndex;
      });
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section aria-label="Предложения NAA.md" aria-roledescription="carousel" className="group min-w-0">
      <div className="relative min-w-0" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
        <div className="scroller-x min-w-0" data-scroller onScroll={(event) => setCurrentIndex(Math.min(slides.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)))} ref={viewportRef}>
          {slides.map((slide, index) => <PromoBanner alt={slide.image.alt} href={slide.ctaHref} images={fallbackImages[index % fallbackImages.length]!} key={slide.id} priority={index === 0} />)}
        </div>
        {slides.length > 1 ? <>
          <button aria-label="Предыдущий баннер" className="absolute -left-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink opacity-0 shadow-card transition-opacity group-hover:opacity-100 desktop:grid" onClick={() => goToSlide((currentIndex - 1 + slides.length) % slides.length)} type="button"><ChevronLeft size={20} /></button>
          <button aria-label="Следующий баннер" className="absolute -right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink opacity-0 shadow-card transition-opacity group-hover:opacity-100 desktop:grid" onClick={() => goToSlide((currentIndex + 1) % slides.length)} type="button"><ChevronRight size={20} /></button>
        </> : null}
      </div>
      <div aria-label="Выбор слайда" className="mt-2 flex items-center justify-center gap-2">
        {slides.map((slide, index) => <button aria-label={`Слайд ${index + 1}`} aria-pressed={index === currentIndex} className={`h-2 w-2 rounded-full ${index === currentIndex ? "bg-accent" : "bg-line"}`} key={slide.id} onClick={() => goToSlide(index)} type="button" />)}
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { HeroSlide } from "@/domain/catalog";

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  function goToSlide(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ behavior: "smooth", left: viewport.clientWidth * index });
    setCurrentIndex(index);
  }

  useEffect(() => {
    if (slides.length < 2) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        const nextIndex = (index + 1) % slides.length;
        const viewport = viewportRef.current;
        viewport?.scrollTo({ behavior: "smooth", left: viewport.clientWidth * nextIndex });
        return nextIndex;
      });
    }, 6000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section aria-label="Предложения Mercedes-Benz" aria-roledescription="carousel" className="min-w-0">
      <div className="scroller-x aspect-[2.3/1] min-w-0 rounded-ui border border-line" data-scroller onScroll={(event) => setCurrentIndex(Math.min(slides.length - 1, Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)))} ref={viewportRef}>
        {slides.map((slide) => (
          <Link aria-label={slide.title} className="relative min-w-full snap-start overflow-hidden" href={slide.ctaHref} key={slide.id}>
            <Image alt={slide.image.alt} className="object-cover" fill priority={slide.sortOrder === 1} sizes="(max-width: 1199px) 100vw, 66vw" src={slide.image.url} />
          </Link>
        ))}
      </div>
      <div aria-label="Выбор слайда" className="mt-2 flex h-4 items-center justify-center gap-1.5">
        {slides.map((slide, index) => <button aria-label={`Слайд ${index + 1}`} aria-pressed={index === currentIndex} className={`h-1.5 w-1.5 rounded-full ${index === currentIndex ? "bg-accent" : "bg-muted"}`} key={slide.id} onClick={() => goToSlide(index)} type="button" />)}
      </div>
    </section>
  );
}

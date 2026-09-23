"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { HeroSlide } from "@/domain/catalog";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2 || isPaused) return;
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % slides.length), 3000);
    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  if (slides.length === 0) return null;

  const endGesture = (clientX: number) => {
    if (startX.current === null) return;
    const distance = clientX - startX.current;
    startX.current = null;
    setDragOffset(0);
    setIsPaused(false);
    if (Math.abs(distance) < 42) return;
    setCurrentIndex((index) => distance < 0 ? (index + 1) % slides.length : (index - 1 + slides.length) % slides.length);
  };

  return (
    <section className="hero-carousel" aria-label="Предложения Mercedes-Benz" aria-roledescription="carousel" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => { if (startX.current === null) setIsPaused(false); }} onPointerCancel={() => { startX.current = null; setDragOffset(0); setIsPaused(false); }} onPointerDown={(event) => { startX.current = event.clientX; setIsPaused(true); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (startX.current !== null) setDragOffset(Math.max(-160, Math.min(160, event.clientX - startX.current))); }} onPointerUp={(event) => endGesture(event.clientX)}>
      <div className={`hero-carousel__track${dragOffset !== 0 ? " is-dragging" : ""}`} style={{ transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))` }}>
        {slides.map((slide) => <a aria-label={slide.title} className="hero-carousel__slide" href={slide.ctaHref} key={slide.id}><Image alt={slide.image.alt} fill priority={slide.sortOrder === 1} sizes="(max-width: 760px) 100vw, 75vw" src={slide.image.url} /></a>)}
      </div>
      <div className="hero-carousel__dots" aria-label="Выбор слайда">{slides.map((slide, index) => <button aria-label={`Слайд ${index + 1}`} aria-pressed={index === currentIndex} className={index === currentIndex ? "is-active" : ""} key={slide.id} onClick={() => setCurrentIndex(index)} type="button" />)}</div>
    </section>
  );
}

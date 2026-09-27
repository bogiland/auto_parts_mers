"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { SectionTitle } from "@/components/ui/SectionTitle";

const brands = [
  { name: "Stellox", image: "/images/brands/stellox.png" },
  { name: "Areol", image: "/images/brands/areol.png" },
  { name: "Furo", image: "/images/brands/furo.png" },
  { name: "Chemipro", image: "/images/brands/chemipro.png" },
  { name: "Comma", image: "/images/brands/comma.png" },
  { name: "Zent Parts", image: "/images/brands/zent-parts.png" },
  { name: "Edcon", image: "/images/brands/edcon.png" },
  { name: "Wezer", image: "/images/brands/wezer.png" },
  { name: "Brix", image: "/images/brands/brix.png" },
  { name: "SK ZIC", image: "/images/brands/sk-zic.png" },
];

export function BrandRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  function scrollRail(direction: number) {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    rail.scrollBy({ behavior: "smooth", left: direction * rail.clientWidth });
  }

  return (
    <section aria-labelledby="brands-title" className="min-w-0">
      <SectionTitle id="brands-title">Популярные бренды</SectionTitle>
      <div className="relative min-w-0">
        <button
          aria-label="Предыдущие бренды"
          className="absolute -left-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card transition hover:text-accent desktop:hidden"
          onClick={() => scrollRail(-1)}
          type="button"
        >
          <ChevronLeft size={20} />
        </button>
        <div
          className="scroller-x min-w-0 gap-2 md:gap-4 desktop:grid desktop:grid-cols-5"
          onScroll={(event) => setIsScrolled(event.currentTarget.scrollLeft > event.currentTarget.clientWidth / 2)}
          ref={railRef}
        >
          {brands.map((brand) => (
            <div
              className="brand-tile relative min-w-0 shrink-0 basis-[calc((100%-16px)/3)] overflow-hidden rounded-ui bg-surface-2 md:basis-[calc((100%-48px)/4)] desktop:basis-auto"
              key={brand.name}
            >
              <Image alt={brand.name} className="object-contain" fill sizes="(min-width: 1200px) 20vw, (min-width: 768px) 25vw, 33vw" src={brand.image} />
            </div>
          ))}
        </div>
        <button
          aria-label="Следующие бренды"
          className="absolute -right-4 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-card transition hover:text-accent desktop:hidden"
          onClick={() => scrollRail(1)}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div aria-label={`Страница брендов ${isScrolled ? 2 : 1}`} className="mt-4 flex justify-center gap-2 desktop:hidden">
        <span className={`h-2 w-2 rounded-full ${isScrolled ? "bg-ink-3" : "bg-accent"}`} />
        <span className={`h-2 w-2 rounded-full ${isScrolled ? "bg-accent" : "bg-ink-3"}`} />
      </div>
    </section>
  );
}

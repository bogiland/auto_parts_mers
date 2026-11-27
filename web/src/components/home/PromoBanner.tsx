import Image from "next/image";
import Link from "next/link";

export interface PromoBannerImages {
  desktop: string;
  mobile: string;
  tablet: string;
}

interface PromoBannerProps {
  alt: string;
  href: string;
  images: PromoBannerImages;
  priority?: boolean;
  title: string;
  subtitle?: string;
  ctaLabel: string;
}

/**
 * Баннер первого экрана: картинка — только фон, заголовок и кнопка — HTML поверх неё.
 * Раньше выводилась одна фоновая картинка без текста, и первый экран выглядел пустым.
 */
export function PromoBanner({ alt, href, images, priority = false, title, subtitle, ctaLabel }: PromoBannerProps) {
  return (
    <div className="hero-banner-viewport relative block min-w-full snap-start overflow-hidden rounded-ui" data-hero-slide>
      <picture className="absolute inset-0 block">
        <source media="(max-width: 767px)" srcSet={images.mobile} />
        <source media="(max-width: 1199px)" srcSet={images.tablet} />
        <Image alt={alt} className="object-cover" fill priority={priority} sizes="(min-width: 1200px) 66vw, 100vw" src={images.desktop} />
      </picture>
      <div className="relative flex h-full max-w-lg flex-col justify-center gap-2 p-4 md:gap-3 md:p-6 xl:p-10">
        <h2 className="text-section font-bold text-ink">{title}</h2>
        {subtitle ? <p className="hidden text-body text-ink-2 md:block">{subtitle}</p> : null}
        <Link className="inline-flex h-11 w-fit items-center rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover" href={href}>{ctaLabel}</Link>
      </div>
    </div>
  );
}

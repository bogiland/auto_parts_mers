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
}

export function PromoBanner({ alt, href, images, priority = false }: PromoBannerProps) {
  return (
    <Link aria-label={alt} className="hero-banner-viewport relative block min-w-full snap-start overflow-hidden rounded-ui" href={href}>
      <picture className="absolute inset-0 block">
        <source media="(max-width: 767px)" srcSet={images.mobile} />
        <source media="(max-width: 1199px)" srcSet={images.tablet} />
        <Image alt={alt} className="object-cover" fill priority={priority} sizes="(min-width: 1200px) 66vw, 100vw" src={images.desktop} />
      </picture>
    </Link>
  );
}

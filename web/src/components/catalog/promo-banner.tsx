import Image from "next/image";

interface PromoBannerProps { alt: string; href: string; image: string; }

export function PromoBanner({ alt, href, image }: PromoBannerProps) {
  return <a aria-label={alt} className="promo-banner" href={href}><Image alt={alt} fill sizes="(max-width: 850px) 100vw, 50vw" src={image} /></a>;
}

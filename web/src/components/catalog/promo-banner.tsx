import Image from "next/image";

interface PromoBannerProps { alt: string; eyebrow?: string; href: string; image: string; title?: string; }

export function PromoBanner({ alt, eyebrow, href, image, title }: PromoBannerProps) {
  return <a aria-label={alt} className="promo-banner" href={href}><Image alt={alt} fill sizes="(max-width: 850px) 100vw, 50vw" src={image} />{title ? <span className="promo-banner__copy">{eyebrow ? <small>{eyebrow}</small> : null}<strong>{title}</strong></span> : null}</a>;
}

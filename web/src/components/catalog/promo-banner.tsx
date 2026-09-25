import Image from "next/image";
import Link from "next/link";

interface PromoBannerProps { alt: string; description: string; eyebrow?: string; href: string; image: string; title: string; }

export function PromoBanner({ alt, description, eyebrow, href, image, title }: PromoBannerProps) {
  return <Link aria-label={alt} className="relative block min-w-0 shrink-0 basis-full overflow-hidden rounded-ui aspect-[2.3/1] md:basis-auto md:aspect-[644/181]" href={href}><Image alt={alt} className="object-cover" fill sizes="(min-width:768px) 50vw, 100vw" src={image} /><span className="absolute inset-0 bg-ink/40" /><span className="absolute inset-0 flex flex-col justify-end p-4 text-white">{eyebrow ? <small className="text-badge font-bold uppercase">{eyebrow}</small> : null}<strong className="mt-2 text-block font-bold">{title}</strong><span className="mt-1 text-body">{description}</span></span></Link>;
}

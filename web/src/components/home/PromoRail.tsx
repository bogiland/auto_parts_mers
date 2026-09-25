import { PromoBanner } from "@/components/catalog/promo-banner";

const banners = [
  { alt: "Автосервис NAA.md", description: "Диагностика и обслуживание вашего автомобиля", href: "/autoservice", image: "/images/banners/autoservice-banner.png", title: "Автосервис NAA.md" },
  { alt: "Автомобили Mercedes-Benz в наличии", description: "Проверенные автомобили в наличии", href: "/catalog/legkovye", image: "/images/hero/mercedes-sedan-parts.png", title: "Автомобили в наличии" },
];

export function PromoRail() {
  return <div className="min-w-0"><div className="-mx-4 scroller-x min-w-0 gap-4 px-4 scroll-px-4 md:mx-0 md:grid md:grid-cols-2 md:px-0" data-scroller>{banners.map((banner) => <PromoBanner {...banner} key={banner.title} />)}</div><div className="mt-4 flex justify-center gap-1.5 md:hidden"><span className="h-1.5 w-1.5 rounded-full bg-accent" /><span className="h-1.5 w-1.5 rounded-full bg-muted" /></div></div>;
}

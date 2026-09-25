import { BadgeCheck, Headphones, Truck } from "lucide-react";

const benefits = [
  { icon: BadgeCheck, title: "Оригинальные", copy: "и совместимые запчасти" },
  { icon: Truck, title: "Быстрая доставка", copy: "по всей Молдове" },
  { icon: Headphones, title: "Подбор экспертом бесплатно", copy: "перезвоним за 15 минут" },
] as const;

export function BenefitStrip() {
  return <section aria-label="Преимущества NAA.md" className="scroller-x min-w-0 gap-4 lg:grid lg:grid-cols-3">{benefits.map(({ icon: Icon, title, copy }) => <div className="flex min-w-0 shrink-0 basis-[80%] items-center gap-3 rounded-ui border border-line p-4 lg:basis-auto" key={title}><Icon aria-hidden="true" className="shrink-0 text-accent" size={32} strokeWidth={1.7} /><p><strong className="block text-body font-bold text-ink">{title}</strong><span className="block text-meta text-ink-2">{copy}</span></p></div>)}</section>;
}

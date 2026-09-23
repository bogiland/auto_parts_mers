import { BadgeCheck, ShieldCheck, Truck } from "lucide-react";

const benefits = [
  { icon: BadgeCheck, title: "Оригинальные", copy: "и совместимые запчасти" },
  { icon: Truck, title: "Быстрая доставка", copy: "по всей Молдове" },
  { icon: ShieldCheck, title: "Проверка на совместимость", copy: "по VIN" },
] as const;

export function BenefitStrip() {
  return <section className="benefit-strip" aria-label="Преимущества NAA.md">{benefits.map(({ icon: Icon, title, copy }) => <div className="benefit-strip__item" key={title}><Icon size={40} strokeWidth={1.65} /><p><strong>{title}</strong><span>{copy}</span></p></div>)}</section>;
}

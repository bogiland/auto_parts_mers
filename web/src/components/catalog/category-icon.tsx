import { Accessibility, AirVent, BatteryCharging, CarFront, CircleGauge, Cog, Disc3, Fuel, Milestone, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Wrench } from "lucide-react";

const icons = { engine: Cog, brakes: Disc3, suspension: SlidersHorizontal, transmission: Settings2, electrical: BatteryCharging, cooling: AirVent, body: CarFront, interior: Accessibility, exhaust: Milestone, filters: Fuel, bearings: CircleGauge, accessories: Sparkles } as const;

export function CategoryIcon({ slug, size = 22 }: { slug: string; size?: number }) {
  const Icon = icons[slug as keyof typeof icons] ?? Wrench;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.65} />;
}

export function MercedesIcon() { return <ShieldCheck aria-hidden="true" size={20} strokeWidth={1.7} />; }

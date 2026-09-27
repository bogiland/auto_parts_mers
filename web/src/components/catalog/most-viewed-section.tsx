import Image from "next/image";
import Link from "next/link";

import type { Product } from "@/domain/catalog";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeader } from "../ui/section-header";

function MaintenancePromo({ compact = false }: { compact?: boolean }) {
  return <Link className={`relative block min-w-0 overflow-hidden rounded-ui ${compact ? "aspect-[2.3/1]" : "h-full"}`} href="/catalog/legkovye?group=maintenance">
    <Image alt="Набор расходников для технического обслуживания" className="object-cover" fill sizes={compact ? "(max-width:1199px) 100vw, 435px" : "435px"} src={compact ? "/images/banners/maintenance-kit-wide.png" : "/images/banners/maintenance-kit.png"} />
    <span className="absolute inset-0 bg-ink/40" />
    <span className="absolute inset-0 flex flex-col justify-between p-4 text-white"><span className="w-fit rounded-badge bg-accent px-2 py-0.5 text-badge font-bold">Расходники для ТО</span><span><strong className="block text-hero font-bold">Товары<br />для ТО</strong><small className="mt-2 block text-body font-bold">Масла, фильтры и тормозная система</small></span></span>
  </Link>;
}

export function MostViewedSection({ products }: { products: Product[] }) {
  return (
    <section className="min-w-0">
      <SectionHeader href="/catalog/legkovye" linkText="Смотреть каталог" title="Самые просматриваемые" />
      <div className="desktop:hidden"><MaintenancePromo compact /><div className="mt-4"><ProductRail products={products.slice(0, 8)} /></div></div>
      <div className="hidden min-w-0 grid-cols-4 gap-4 desktop:grid">
        <MaintenancePromo />
        <div className="col-span-3 grid min-w-0 grid-cols-4 gap-4">{products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </div>
    </section>
  );
}

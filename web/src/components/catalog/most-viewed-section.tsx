import Image from "next/image";
import Link from "next/link";

import type { Product } from "@/domain/catalog";

import { ProductCard } from "./product-card";
import { SectionHeader } from "../ui/section-header";

export function MostViewedSection({ products }: { products: Product[] }) {
  return (
    <section className="most-viewed">
      <SectionHeader href="/catalog/legkovye" linkText="Смотреть каталог" title="Самые просматриваемые" />
      <div className="most-viewed__content">
        <Link className="most-viewed__banner" href="/catalog/legkovye?group=maintenance">
          <Image alt="Набор расходников для технического обслуживания" className="most-viewed__banner-image most-viewed__banner-image--desktop" fill sizes="435px" src="/images/banners/maintenance-kit.png" />
          <Image alt="Набор расходников для технического обслуживания" className="most-viewed__banner-image most-viewed__banner-image--compact" fill sizes="(max-width: 1023px) 100vw, 435px" src="/images/banners/maintenance-kit-wide.png" />
          <span>Расходники для ТО</span>
          <strong>Товары<br />для ТО</strong>
          <small>Масла, фильтры и тормозная система</small>
        </Link>
        <div className="most-viewed__products">{products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </div>
    </section>
  );
}

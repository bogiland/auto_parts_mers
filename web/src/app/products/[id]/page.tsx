import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProductDetails } from "@/components/product/ProductDetails";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeader } from "@/components/ui/section-header";
import { getHomepage } from "@/lib/catalog-gateway";

export async function generateStaticParams() {
  const homepage = await getHomepage();
  return [...homepage.popularProducts, ...homepage.recommendedProducts].map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const homepage = await getHomepage();
  const product = [...homepage.popularProducts, ...homepage.recommendedProducts].find((item) => item.id === id);
  return { title: product ? `${product.name} — NAA.md` : "Товар не найден — NAA.md" };
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const homepage = await getHomepage();
  const products = [...homepage.popularProducts, ...homepage.recommendedProducts];
  const product = products.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const recommendations = products.filter((item) => item.id !== product.id).slice(0, 6);

  return (
    <>
      <SiteHeader hours={homepage.hours} phone={homepage.phone} />
      <main className="container-site section-stack bg-surface-2">
        <nav aria-label="Хлебные крошки" className="text-meta text-ink-2">
          <Link className="hover:text-accent" href="/">Главная</Link><span aria-hidden="true"> / </span><Link className="hover:text-accent" href="/catalog/legkovye">Каталог</Link><span aria-hidden="true"> / </span><span className="text-ink">{product.name}</span>
        </nav>
        <ProductDetails product={product} />
        <section>
          <SectionHeader title="Похожие товары" />
          <ProductRail products={recommendations} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

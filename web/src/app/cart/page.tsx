import type { Metadata } from "next";
import { CartPage } from "@/components/cart/CartPage";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Корзина — NAA.md",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Корзина видит весь склад: раньше в ней были только стартовые товары, и деталь из админки
  // (W212 и любая другая) показывалась как «Товар больше недоступен». Склад идёт последним и вытесняет дубли.
  const homepage = await getLiveHomepage();
  const products = [...new Map([...homepage.popularProducts, ...homepage.recommendedProducts, ...(homepage.liveProducts ?? [])].map((product) => [product.id, product])).values()];
  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><CartPage products={products} /><SiteFooter /></>;
}

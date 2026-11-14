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
  const homepage = await getLiveHomepage();
  const products = [...homepage.popularProducts, ...homepage.recommendedProducts];
  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><CartPage products={products} /><SiteFooter /></>;
}

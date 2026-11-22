import type { Metadata } from "next";
import { FavoritesPage } from "@/components/favorites/FavoritesPage";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Избранное — NAA.md", robots: { index: false, follow: false } };

export default async function Page() {
  const homepage = await getLiveHomepage({ includeInventory: false });
  const products = [...homepage.popularProducts, ...homepage.recommendedProducts];
  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><FavoritesPage products={products} /><SiteFooter /></>;
}

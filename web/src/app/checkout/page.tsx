import type { Metadata } from "next";
import { CheckoutPage } from "@/components/checkout/CheckoutPage";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Оформление заказа — NAA.md", robots: { index: false, follow: false } };
export default async function Page() {
  const homepage = await getLiveHomepage({ includeInventory: false });
  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><CheckoutPage /><SiteFooter /></>;
}

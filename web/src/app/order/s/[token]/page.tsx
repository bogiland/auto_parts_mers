import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatus } from "@/components/checkout/OrderStatus";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getOrderByToken } from "@/lib/checkout-db";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Статус заказа — NAA.md", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(token)) notFound();
  const order = getOrderByToken(token);
  if (!order) notFound();
  const homepage = await getLiveHomepage();
  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><OrderStatus order={order} /><SiteFooter /></>;
}

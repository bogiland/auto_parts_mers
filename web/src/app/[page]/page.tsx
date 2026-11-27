import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SitePageView } from "@/components/pages/SitePageView";
import { getSettings } from "@/lib/checkout-db";
import { getLiveHomepage } from "@/lib/live-catalog";
import { findPage } from "@/lib/pages-db";
import { publicDonors } from "@/lib/parts-db";

type Props = { params: Promise<{ page: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { page: slug } = await params;
  const page = (await findPage(slug));
  if (!page) return { title: "Страница не найдена — NAA.md", robots: { index: false, follow: false } };
  // /cars показывает только реальных доноров. Пока их нет — страница не индексируется.
  const noIndex = slug === "cars" && !(await publicDonors()).length;
  return {
    title: page.seoTitle || `${page.titleRu} — NAA.md`,
    description: page.seoDescription || undefined,
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SitePageRoute({ params }: Props) {
  const { page: slug } = await params;
  // Выключенная страница недоступна: findPage её не вернёт, и посетитель получит 404.
  const page = (await findPage(slug));
  if (!page) notFound();
  const homepage = await getLiveHomepage();
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <SitePageView donors={slug === "cars" ? (await publicDonors()) : undefined} page={page} settings={(await getSettings())} />
    <SiteFooter />
  </>;
}

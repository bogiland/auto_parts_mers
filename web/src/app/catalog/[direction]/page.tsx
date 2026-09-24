import { notFound } from "next/navigation";

import { DirectionHome } from "@/components/catalog/direction-home";
import { SecondaryNav } from "@/components/layout/secondary-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getDirectionHome } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";

export default async function CatalogDirectionPage({ params }: PageProps<"/catalog/[direction]">) {
  const { direction: directionSlug } = await params;
  const direction = getDirectionHome(directionSlug);
  if (!direction) notFound();

  const homepage = await getHomepage();

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><SecondaryNav /><DirectionHome direction={direction} homepage={homepage} /><SiteFooter /></>;
}

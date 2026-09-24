import { notFound } from "next/navigation";

import { DirectionHome } from "@/components/catalog/direction-home";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getDirectionHome } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";

export default async function CatalogDirectionPage({ params }: PageProps<"/catalog/[direction]">) {
  const { direction: directionSlug } = await params;
  const direction = getDirectionHome(directionSlug);
  if (!direction) notFound();

  const homepage = await getHomepage();

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><DirectionHome direction={direction} homepage={homepage} /><SiteFooter /></>;
}

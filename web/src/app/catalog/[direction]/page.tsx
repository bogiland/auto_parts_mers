import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogResultsPage } from "@/components/catalog/CatalogResultsPage";
import { DirectionHome } from "@/components/catalog/direction-home";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getDirectionHome } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";
import { categorySlugFromPath, type SearchParamsRecord } from "@/lib/catalog-listing";

type CatalogDirectionPageProps = {
  params: Promise<{ direction: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export async function generateMetadata({ params }: CatalogDirectionPageProps): Promise<Metadata> {
  const { direction } = await params;
  const homepage = await getHomepage();
  const category = homepage.categories.find((item) => item.slug === categorySlugFromPath(direction));
  if (category) return { description: `Автозапчасти категории «${category.name}»: цены, наличие и подбор экспертом.`, title: `${category.name} — купить автозапчасти | NAA.md` };
  const directionHome = getDirectionHome(direction);
  return { description: directionHome?.description ?? "Каталог автозапчастей NAA.md.", title: directionHome?.pageTitle ?? "Каталог запчастей — NAA.md" };
}

export default async function CatalogDirectionPage({ params, searchParams }: CatalogDirectionPageProps) {
  const [{ direction: segment }, homepage, query] = await Promise.all([params, getHomepage(), searchParams]);
  const direction = getDirectionHome(segment);
  if (direction) return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><DirectionHome direction={direction} homepage={homepage} /><SiteFooter /></>;

  const categorySlug = categorySlugFromPath(segment);
  const category = homepage.categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><CatalogResultsPage categoryName={category.name} categorySlug={category.slug} homepage={homepage} searchParams={query} /><SiteFooter /></>;
}

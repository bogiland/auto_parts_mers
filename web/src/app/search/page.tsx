import type { Metadata } from "next";

import { CatalogResultsPage } from "@/components/catalog/CatalogResultsPage";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getHomepage } from "@/lib/catalog-gateway";
import type { SearchParamsRecord } from "@/lib/catalog-listing";

type SearchPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export const metadata: Metadata = {
  description: "Поиск автозапчастей по названию, артикулу, категории и производителю.",
  robots: { follow: true, index: false },
  title: "Поиск запчастей — NAA.md",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [homepage, params] = await Promise.all([getHomepage(), searchParams]);

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><CatalogResultsPage homepage={homepage} isSearch searchParams={params} /><SiteFooter /></>;
}

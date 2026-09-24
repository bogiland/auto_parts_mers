import { notFound } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getDirectionHome, sourceCategorySlug } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";

export default async function CatalogCategoryPage({ params }: PageProps<"/catalog/[direction]/[...categoryPath]">) {
  const { categoryPath, direction: directionSlug } = await params;
  const direction = getDirectionHome(directionSlug);
  if (!direction) notFound();

  const homepage = await getHomepage();
  const categorySlug = sourceCategorySlug(categoryPath.at(-1) ?? "");
  const category = homepage.categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><main className="page-shell catalog-category-page"><p><Link href={`/catalog/${direction.slug}`}>{direction.name}</Link> / {category.name}</p><h1>{category.name}</h1><span>Каталог направления «{direction.name}». Здесь появятся товары и фильтры после подключения API поставщиков.</span></main><SiteFooter /></>;
}

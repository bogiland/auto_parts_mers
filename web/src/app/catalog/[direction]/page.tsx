import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { DirectionHome } from "@/components/catalog/direction-home";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getDirectionHome } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";
import { getLiveHomepage } from "@/lib/live-catalog";
import { listBrands, publicCategories } from "@/lib/reference-db";
import { showroomVehicles } from "@/lib/vehicles-db";
import { categorySlugFromPath, type SearchParamsRecord } from "@/lib/catalog-listing";

type CatalogDirectionPageProps = {
  params: Promise<{ direction: string }>;
  searchParams: Promise<SearchParamsRecord>;
};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CatalogDirectionPageProps): Promise<Metadata> {
  const { direction } = await params;
  const homepage = await getHomepage();
  const category = homepage.categories.find((item) => item.slug === categorySlugFromPath(direction));
  if (category) return { description: `Автозапчасти категории «${category.name}»: цены, наличие и подбор экспертом.`, title: `${category.name} — купить автозапчасти | NAA.md` };
  const directionHome = getDirectionHome(direction);
  return { description: directionHome?.description ?? "Каталог автозапчастей NAA.md.", title: directionHome?.pageTitle ?? "Каталог запчастей — NAA.md" };
}

export default async function CatalogDirectionPage({ params, searchParams }: CatalogDirectionPageProps) {
  const [{ direction: segment }, homepage, query] = await Promise.all([params, (await getLiveHomepage()), searchParams]);
  const direction = getDirectionHome(segment);
  if (direction) {
    // Раздел справочника с тем же адресом, что и направление: его подкатегории и показываем.
    const own = (await publicCategories()).find((category) => category.slug === direction.slug);
    const ownCategories = own?.children.map((child) => ({
      id: child.id, slug: child.slug, name: child.name, productCount: 0,
      image: { alt: child.name, url: child.image }, isVisible: true,
    })) ?? [];
    // Машины и бренды деталей — из общего справочника, одного для меню, каталога и подбора.
    const [makes, partBrands] = await Promise.all([showroomVehicles(), listBrands()]);
    return <><SiteHeader hours={homepage.hours} phone={homepage.phone} /><DirectionHome direction={direction} homepage={homepage} makes={makes} ownCategories={ownCategories} partBrands={partBrands.map(({ id, name }) => ({ id, name }))} /><SiteFooter /></>;
  }

  // Адрес старого вида /catalog/<раздел>: раздел живёт внутри легковых. Перенаправляем
  // туда с теми же фильтрами, а не отдаём 404 — по таким ссылкам приходят из закладок и поиска.
  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) rest.append(key, entry);
  permanentRedirect(`/catalog/legkovye/${encodeURIComponent(segment)}${rest.size ? `?${rest}` : ""}`);
}

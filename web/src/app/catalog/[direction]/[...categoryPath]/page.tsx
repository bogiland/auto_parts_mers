import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { CatalogResultsPage } from "@/components/catalog/CatalogResultsPage";
import { VehicleJourney } from "@/components/catalog/vehicle-journey";
import { ProductRail } from "@/components/product/ProductRail";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SectionHeader } from "@/components/ui/section-header";
import { getDirectionHome, sourceCategorySlug } from "@/data/directions.seed";
import { getHomepage } from "@/lib/catalog-gateway";
import { getLiveHomepage } from "@/lib/live-catalog";
import { categorySlugFromPath, type SearchParamsRecord } from "@/lib/catalog-listing";
import { getBrands, getModels } from "@/lib/vehicles";
import { findPublicCategory } from "@/lib/reference-db";

type CatalogCategoryPageProps = {
  params: Promise<{ categoryPath: string[]; direction: string }>;
  searchParams: Promise<SearchParamsRecord>;
};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const params = getBrands().map((brand) => ({ direction: "legkovye", categoryPath: [brand.slug] }));
  const mercedesModels = await getModels("mercedes-benz");
  return [...params, ...mercedesModels.map((model) => ({ direction: "legkovye", categoryPath: ["mercedes-benz", model.slug] }))];
}

export async function generateMetadata({ params }: CatalogCategoryPageProps) {
  const { categoryPath, direction } = await params;
  const own = findPublicCategory(categoryPath.at(-1) ?? "");
  if (own && own.status !== "redirect") {
    if (own.status === "hidden") return { robots: { index: false, follow: false }, title: "Раздел временно недоступен — NAA.md" };
    return { description: own.seoDescription || `Автозапчасти категории «${own.name}»: цены, наличие и подбор экспертом.`, title: own.seoTitle || `${own.name} — купить автозапчасти | NAA.md` };
  }
  const homepage = await getHomepage();
  const category = homepage.categories.find((item) => item.slug === categorySlugFromPath(categoryPath.at(-1) ?? ""));
  if (category) return { description: `Автозапчасти категории «${category.name}»: цены, наличие и подбор экспертом.`, title: `${category.name} — купить автозапчасти | NAA.md` };
  if (direction === "legkovye" && categoryPath.length > 1) return { title: `Запчасти для ${categoryPath.slice(0, 2).join(" ")} — NAA.md` };
  return { title: "Каталог запчастей — NAA.md" };
}

export default async function CatalogCategoryPage({ params, searchParams }: CatalogCategoryPageProps) {
  const [{ categoryPath, direction: directionSlug }, query] = await Promise.all([params, searchParams]);
  const direction = getDirectionHome(directionSlug);
  if (!direction) notFound();
  const homepage = await getLiveHomepage();
  const [first] = categoryPath;
  const vehicleBrand = directionSlug === "legkovye" ? getBrands().find((item) => item.slug === first) : null;
  const own = findPublicCategory(categoryPath.at(-1) ?? "");
  if (own?.status === "redirect") permanentRedirect(`/catalog/${directionSlug}/${own.slug}`);

  let content: React.ReactNode;
  if (directionSlug === "legkovye" && first === "brands") {
    content = <main className="container-site section-stack bg-surface-2 pb-12 pt-4"><section className="rounded-ui bg-white p-4 desktop:p-6"><SectionHeader title="Все марки автомобилей" /><div className="grid grid-cols-2 gap-2 md:grid-cols-4 desktop:grid-cols-5">{getBrands().map((brand) => <Link className="rounded-ui p-3 text-body font-bold text-ink hover:bg-surface-2" href={`/catalog/legkovye/${brand.slug}`} key={brand.slug}>{brand.name}</Link>)}</div></section></main>;
  } else if (directionSlug === "legkovye" && first === "categories") {
    content = <main className="container-site section-stack bg-surface-2 pb-12 pt-4"><section className="rounded-ui bg-white p-4 desktop:p-6"><SectionHeader title="Все категории" /><div className="grid grid-cols-2 gap-2 md:grid-cols-4 desktop:grid-cols-6">{homepage.categories.map((category) => <Link className="rounded-ui bg-surface-2 p-3 text-body font-bold text-ink hover:text-accent" href={`/catalog/legkovye/${category.slug}`} key={category.id}>{category.name}</Link>)}</div></section></main>;
  } else if (directionSlug === "legkovye" && first === "all") {
    content = <main className="container-site section-stack bg-surface-2 pb-12 pt-4"><section className="rounded-ui bg-white p-4 desktop:p-6"><SectionHeader title="Все запчасти" /><ProductRail products={[...homepage.popularProducts, ...homepage.recommendedProducts]} /></section></main>;
  } else if (vehicleBrand) {
    content = await VehicleJourney({ homepage, path: categoryPath });
    if (!content) notFound();
  } else if (own && own.status === "hidden") {
    content = <main className="container-site section-stack bg-surface-2 pb-12 pt-4"><section className="rounded-ui bg-white p-4 desktop:p-6"><h1 className="text-section font-bold text-ink">Раздел временно недоступен</h1><p className="mt-2 text-body text-ink-2">Этот раздел каталога сейчас закрыт. Загляните позже или напишите оператору — подберём деталь вручную.</p><Link className="mt-4 inline-flex rounded-ui bg-accent px-4 py-3 text-btn font-bold text-white hover:bg-accent-hover" href="/catalog/legkovye">Вернуться в каталог</Link></section></main>;
  } else if (own && own.status === "ok") {
    content = <CatalogResultsPage categoryName={own.name} categorySlug={own.slug} homepage={homepage} intro={own.intro} ownCategoryId={own.id} searchParams={query} />;
  } else {
    const categorySlug = categorySlugFromPath(sourceCategorySlug(categoryPath.at(-1) ?? ""));
    const category = homepage.categories.find((item) => item.slug === categorySlug);
    if (!category) notFound();
    content = <CatalogResultsPage categoryName={category.name} categorySlug={category.slug} homepage={homepage} searchParams={query} />;
  }

  return <><SiteHeader hours={homepage.hours} phone={homepage.phone} />{content}<SiteFooter /></>;
}

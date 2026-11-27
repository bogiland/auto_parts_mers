import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProductDetails, type CardFacts } from "@/components/product/ProductDetails";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeader } from "@/components/ui/section-header";
import { getHomepage } from "@/lib/catalog-gateway";
import { getLiveHomepage, toStoreProduct } from "@/lib/live-catalog";
import { partByPublicId, productRedirect } from "@/lib/parts-db";
import { ReviewsBlock } from "@/components/reviews/ReviewsBlock";
import { AdSlot } from "@/components/ads/AdSlot";
import { rating } from "@/lib/reviews";
import { selectedCar } from "@/lib/selected-car";
import { getSettings } from "@/lib/checkout-db";
import { categoryPath, fitmentsOf, listAttrTemplates, relatedCategories } from "@/lib/attributes-db";
import { formatAttrs, templatesFor } from "@/lib/attributes";
import { categoryBasePath } from "@/data/directions.seed";
import { donorsOf, showroomVehicles, vehicleSlug } from "@/lib/vehicles-db";
import type { Product } from "@/domain/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const homepage = await getHomepage();
  return [...homepage.popularProducts, ...homepage.recommendedProducts].map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const homepage = await getHomepage();
  const own = (await partByPublicId(id));
  const product = [...homepage.popularProducts, ...homepage.recommendedProducts].find((item) => item.id === id);
  const name = own && !own.hidden ? own.nameRu : product?.name;
  return { title: name ? `${name} — NAA.md` : "Товар не найден — NAA.md" };
}

function daysWord(count: number) {
  const tail = count % 100 >= 11 && count % 100 <= 14 ? 0 : count % 10;
  if (tail === 1) return "день";
  if (tail >= 2 && tail <= 4) return "дня";
  return "дней";
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const homepage = await getLiveHomepage();
  const starters = [...homepage.popularProducts, ...homepage.recommendedProducts];
  // Склад — единственный источник: если деталь заведена в базе, карточка берёт данные оттуда
  // (тип, характеристики, донор, состояние). Стартовая витрина — только запасной вариант.
  const own = (await partByPublicId(id));
  const product: Product | undefined = own && !own.hidden && own.sku ? await toStoreProduct(own) : starters.find((item) => item.id === id || item.sku === id);

  if (!product) {
    // Старый адрес дубля ведёт на основную карточку: ссылки из переписки и поиска
    // продолжают работать, а поисковик склеивает две страницы в одну.
    const moved = await productRedirect(id);
    if (moved) permanentRedirect(`/products/${moved}`);
    notFound();
  }

  const [{ car }, settings, templates, path, fitments, makes] = await Promise.all([
    selectedCar(), getSettings(), listAttrTemplates(), categoryPath(own?.categoryId ?? null), own ? fitmentsOf(own.id) : Promise.resolve([]), showroomVehicles(),
  ]);
  const summary = await rating(product.id); product.rating = summary?.average ?? 0; product.reviewCount = summary?.count ?? 0;

  // Таблица характеристик по шаблону категории и типа. Пустые поля не показываются.
  const specs = own ? formatAttrs(templatesFor(templates, path, own.partTypeId), own.attrs) : [];
  const returnDays = Number((settings as { returnDays?: number }).returnDays ?? 2);
  const facts: CardFacts = {
    specs,
    fitments: fitments.map((item) => ({ ...item })),
    returnLine: product.returnRestricted
      ? { restricted: true, text: "Возврату не подлежит. Осмотрите деталь при получении." }
      : { restricted: false, text: `Возврат ${returnDays} ${daysWord(returnDays)}: деталь с нашей меткой, доставку обратно оплачивает покупатель.` },
    conditionNote: own?.conditionNote ?? "",
    applicability: own?.applicability ?? "",
  };

  // «Эта же категория» — для выбранной машины, а если её нет — для машины-донора этой детали.
  const donorCar = own?.donor ?? null;
  const targetCar = car ?? (donorCar ? (() => {
    const make = makes.find((item) => item.slug === vehicleSlug(donorCar.make));
    const model = make?.models.find((item) => item.slug === vehicleSlug(donorCar.model));
    const generation = model?.generations.find((item) => item.slug === vehicleSlug(donorCar.generation));
    if (!make || !model) return null;
    return { label: [make.name, model.name, generation?.name !== model.name ? generation?.name : ""].filter(Boolean).join(" "), donorIds: donorsOf(make, model.slug, generation?.slug), slug: [make.slug, model.slug, generation?.slug].filter(Boolean).join("/") };
  })() : null);
  const live = (homepage.liveProducts ?? []).filter((item) => item.id !== product.id && (item.stock ?? 0) > 0);
  const sameDonor = own?.donorId ? live.filter((item) => item.donorId === own.donorId).slice(0, 12) : [];
  const sameCategory = own?.categoryId
    ? live.filter((item) => item.categoryId === own.categoryId && !sameDonor.includes(item) && (!targetCar || (item.donorId && targetCar.donorIds.includes(item.donorId)))).slice(0, 12)
    : [];
  // Сопутствующие разделы: к диску — колодки и датчики, к маслу — фильтры.
  const related = await relatedCategories(path);
  const carQuery = targetCar ? `?car=${encodeURIComponent(targetCar.slug)}` : "";

  return (
    <>
      <SiteHeader hours={homepage.hours} phone={homepage.phone} />
      <main className="container-site section-stack bg-surface">
        <nav aria-label="Хлебные крошки" className="text-meta text-ink-2">
          <Link className="hover:text-accent" href="/">Главная</Link><span aria-hidden="true"> / </span><Link className="hover:text-accent" href="/catalog/legkovye">Каталог</Link><span aria-hidden="true"> / </span><span className="text-ink">{product.name}</span>
        </nav>
        <ProductDetails car={car} facts={facts} key={product.id} product={product} />
        {related.length ? <section className="min-w-0" data-related>
          <SectionHeader title="Вместе с этой деталью берут" />
          <div className="flex min-w-0 flex-wrap gap-2">{related.map((item) => <Link className="rounded-ui bg-surface-2 px-3 py-2 text-body font-bold text-ink hover:text-accent" href={`${item.parentSlug ? categoryBasePath(item.parentSlug) : "/catalog/legkovye"}/${item.slug}${carQuery}`} key={item.id}>{item.name}{targetCar ? ` для ${targetCar.label}` : ""}</Link>)}</div>
        </section> : null}
        {sameDonor.length ? <section className="min-w-0" data-same-donor>
          <SectionHeader href={own?.donorId ? `/donors/${own.donorId}` : undefined} linkText="Все детали с этой машины" title="Ещё с этого донора" />
          <ProductRail products={sameDonor} />
        </section> : null}
        {sameCategory.length ? <section className="min-w-0" data-same-category>
          <SectionHeader title={`Эта же категория${targetCar ? ` для ${targetCar.label}` : ""}`} />
          <ProductRail products={sameCategory} />
        </section> : null}
        <AdSlot slot="product" />
        <ReviewsBlock productId={product.id} compact />
      </main>
      <SiteFooter />
    </>
  );
}

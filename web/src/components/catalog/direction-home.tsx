import { Headphones } from "lucide-react";
import Link from "next/link";

import { categoriesForDirection, categoryPathSlug, type DirectionHomeDefinition } from "@/data/directions.seed";
import type { Category, HomepageData } from "@/domain/catalog";

import { CategoryCard } from "./category-card";
import { VehiclePicker, type PickerMake } from "./vehicle-picker";
import { ProductRail } from "@/components/product/ProductRail";
import { SectionHeader } from "../ui/section-header";

export function DirectionHome({ direction, homepage, ownCategories, makes = [], partBrands = [] }: { direction: DirectionHomeDefinition; homepage: HomepageData; ownCategories?: Category[]; makes?: PickerMake[]; partBrands?: { id: string; name: string }[] }) {
  // Если у направления есть одноимённый раздел справочника, показываем его собственные
  // подкатегории. Иначе страница повторяла бы весь каталог целиком.
  const categories = ownCategories?.length ? ownCategories : categoriesForDirection(homepage.categories, direction);
  const products = [...homepage.popularProducts, ...homepage.recommendedProducts].slice(direction.productOffset, direction.productOffset + 9);
  // Бренды деталей берём из справочника владельца; пока он пуст — из набора направления,
  // но только для автохимии: там это действительно производители, а не марки машин.
  const brandList = partBrands.length ? partBrands.map((brand) => brand.name) : direction.slug === "avtohimiya" ? direction.brands : [];

  return (
    <main className="container-site section-stack bg-surface-2 pb-12 pt-4 desktop:pt-6 direction-home-page">
      <section className="rounded-ui bg-white p-4 desktop:p-6" aria-labelledby="direction-title"><p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / {direction.name}</p><h1 className="mt-2 text-block font-bold text-ink" id="direction-title">{direction.pageTitle}</h1><span className="mt-2 block text-body text-ink-2">{direction.description}</span></section>
      <section className="direction-selection-grid" aria-labelledby="selection-title"><div><h2 className="sr-only" id="selection-title">Подбор запчастей</h2><VehiclePicker makes={makes} /></div><aside className="flex min-w-0 flex-col justify-center rounded-ui bg-white p-4 desktop:p-6" aria-label="Помощь с подбором" id="expert-request"><Headphones aria-hidden="true" className="text-accent" size={28} /><h2 className="mt-4 text-lead font-bold text-ink">Нужна помощь с подбором?</h2><p className="mt-2 text-body text-ink-2">Эксперт уточнит автомобиль и поможет выбрать подходящую деталь.</p><a className="mt-4 inline-flex h-btn items-center justify-center rounded-ui border border-accent px-4 text-btn font-bold text-accent hover:bg-surface-2" href="#expert-request">Оставить заявку</a></aside></section>
      {/* Бренд детали — это производитель: Bosch, Zimmermann, Castrol. Раньше в этом блоке
          у легковых стояли марки машин, и ссылки вели на пустые страницы вроде /catalog/legkovye/audi.
          Марка машины теперь живёт только в подборе выше. */}
      {brandList.length ? <section className="rounded-ui bg-white p-4 desktop:p-6"><SectionHeader href={`/catalog/${direction.slug}/brands`} linkText="Все марки авто" title="Бренды деталей" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4 desktop:grid-cols-5">{brandList.map((brand) => <Link className="text-body font-bold text-ink-2 hover:text-accent" href={`/catalog/${direction.slug}/all?brand=${encodeURIComponent(brand)}`} key={brand}>{brand}</Link>)}</div></section> : null}
      <section className="rounded-ui bg-white p-4 desktop:p-6 popular-categories direction-categories"><SectionHeader href={`/catalog/${direction.slug}/categories`} linkText="Все категории" title="Категории направления" /><div className="category-grid">{categories.map((category) => <CategoryCard basePath={`/catalog/${direction.slug}`} category={category} key={category.id} pathSlug={ownCategories?.length ? category.slug : categoryPathSlug(category.slug)} />)}</div></section>
      <section className="rounded-ui bg-white p-4 desktop:p-6 popular-products direction-products"><SectionHeader href={`/catalog/${direction.slug}/all`} linkText="Смотреть каталог" title="Популярное в направлении" /><ProductRail products={products} /></section>
      <section className="direction-seo" aria-labelledby="direction-seo-title"><h2 id="direction-seo-title">{direction.name}: ассортимент, подбор и доставка</h2><div><p>В каталоге собраны востребованные запчасти и расходники. Поиск можно начать с артикула, марки и модели автомобиля.</p><p>Если деталь требует проверки совместимости, оставьте заявку: специалист сверит параметры автомобиля и предложения поставщиков.</p></div></section>
    </main>
  );
}

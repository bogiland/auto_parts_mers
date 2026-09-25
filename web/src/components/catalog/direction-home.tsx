import { Headphones, Search } from "lucide-react";
import Link from "next/link";

import { categoriesForDirection, categoryPathSlug, type DirectionHomeDefinition } from "@/data/directions.seed";
import type { HomepageData } from "@/domain/catalog";

import { CategoryCard } from "./category-card";
import { SectionHeader } from "../ui/section-header";
import { ProductRail } from "@/components/product/ProductRail";

export function DirectionHome({ direction, homepage }: { direction: DirectionHomeDefinition; homepage: HomepageData }) {
  const categories = categoriesForDirection(homepage.categories, direction);
  const products = [...homepage.popularProducts, ...homepage.recommendedProducts]
    .slice(direction.productOffset, direction.productOffset + 9);

  return (
    <main className="container-site section-stack pt-4 xl:pt-6 pb-12 direction-home-page">
        <section className="direction-intro" aria-labelledby="direction-title">
          <p><Link href="/">Главная</Link> / {direction.name}</p>
          <h1 id="direction-title">{direction.pageTitle}</h1>
          <span>{direction.description}</span>
        </section>
        <section className="direction-selection-grid" aria-labelledby="selection-title">
          <form action={`/catalog/${direction.slug}`} className="direction-selector" role="search">
            <div className="direction-selector__heading"><p>Подбор запчастей</p><h2 id="selection-title">{direction.selectionTitle}</h2><span>{direction.selectionHint}</span></div>
            <label><span>VIN или госномер</span><input name="vin" placeholder="VIN или госномер" type="search" /></label>
            <label><span>Марка и модель</span><input name="vehicle" placeholder="Например, Mercedes E-Class" type="search" /></label>
            <label className="direction-selector__part"><span>Что требуется</span><input name="q" placeholder="Артикул или название детали" type="search" /></label>
            <button className="button button--red" type="submit"><Search size={17} />Найти</button>
          </form>
          <aside className="direction-help" aria-label="Помощь с подбором">
            <Headphones aria-hidden="true" size={28} />
            <h2>Нужна помощь с подбором?</h2>
            <p>Эксперт уточнит автомобиль и поможет выбрать подходящую деталь.</p>
            <a className="button button--outline" href="tel:+37368123456">Оставить заявку</a>
          </aside>
        </section>
        <section className="direction-brands">
          <SectionHeader href={`/catalog/${direction.slug}`} linkText="Все бренды" title="Популярные бренды" />
          <div>{direction.brands.map((brand) => <Link href={`/catalog/${direction.slug}?brand=${encodeURIComponent(brand)}`} key={brand}>{brand}</Link>)}</div>
        </section>
        <section className="popular-categories direction-categories">
          <SectionHeader href={`/catalog/${direction.slug}`} linkText="Все категории" title="Категории направления" />
          <div className="category-grid">{categories.map((category) => <CategoryCard basePath={`/catalog/${direction.slug}`} category={category} key={category.id} pathSlug={categoryPathSlug(category.slug)} />)}</div>
        </section>
        <section className="popular-products direction-products">
          <SectionHeader href={`/catalog/${direction.slug}`} linkText="Смотреть каталог" title="Популярное в направлении" />
          <ProductRail products={products} />
        </section>
        <section className="direction-seo" aria-labelledby="direction-seo-title">
          <h2 id="direction-seo-title">{direction.name}: ассортимент, подбор и доставка</h2>
          <div><p>В каталоге собраны востребованные запчасти и расходники. Поиск можно начать с артикула, VIN или марки автомобиля.</p><p>Если деталь требует проверки совместимости, оставьте заявку: специалист сверит параметры автомобиля и предложения поставщиков.</p></div>
        </section>
    </main>
  );
}

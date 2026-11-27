import Link from "next/link";

import Image from "next/image";
import { redirect } from "next/navigation";

import { DonorRequest } from "@/components/donors/DonorRequest";
import { donorById } from "@/lib/parts-db";

import { RememberCar } from "@/components/catalog/CarPlaque";
import { ProductCard } from "@/components/product/ProductCard";
import { createCatalogListing } from "@/lib/catalog-listing";
import type { HomepageData } from "@/domain/catalog";
import { donorsOf, showroomMake, type ShowroomMake } from "@/lib/vehicles-db";

/**
 * Подбор по машине: марка → модель → поколение → детали.
 *
 * Раньше здесь разворачивался модельный ряд новых машин из `data/vehicles`:
 * годы, поколения и модификации с мощностью и приводом. Данные были только
 * по Mercedes-Benz, у E-класса значился W213, а на разборке стоит W212 — человек
 * доходил до конца и упирался в пустоту. Теперь шаги строятся от доноров: видно
 * ровно те машины, детали с которых лежат на полке, и сразу сколько их.
 */

function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return <nav aria-label="Хлебные крошки" className="flex flex-wrap gap-2 text-meta text-ink-2">
    <Link href="/">Главная</Link>
    {items.map((item) => <span key={item.label}>/ {item.href ? <Link className="hover:text-accent" href={item.href}>{item.label}</Link> : item.label}</span>)}
  </nav>;
}

function Stock({ parts, inStock }: { parts: number; inStock: number }) {
  return <span className="block text-meta font-normal text-ink-2">{parts} {partsWord(parts)} · {inStock} в наличии</span>;
}

function partsWord(count: number) {
  const tail = count % 100 >= 11 && count % 100 <= 14 ? 0 : count % 10;
  if (tail === 1) return "деталь";
  if (tail >= 2 && tail <= 4) return "детали";
  return "деталей";
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container-site section-stack bg-surface-2 pb-12 pt-4">
    <section className="rounded-ui bg-white p-4 desktop:p-6">{children}</section>
  </main>;
}

const tile = "rounded-ui bg-surface-2 p-3 text-body font-bold text-ink hover:bg-accent hover:text-white";

export async function VehicleJourney({ homepage, path }: { homepage: HomepageData; path: string[] }) {
  const [makeSlug, modelSlug, generationSlug] = path;
  const make: ShowroomMake | null = await showroomMake(makeSlug);
  if (!make) return null;
  const base = `/catalog/legkovye/${make.slug}`;

  // Шаг с единственным вариантом проходится сам: выбирать из одной модели незачем.
  if (!modelSlug && make.models.length === 1) redirect(`${base}/${make.models[0]!.slug}`);
  if (!modelSlug) {
    return <Shell>
      <Crumbs items={[{ href: base, label: make.name }, { label: "Выберите модель" }]} />
      <h1 className="mt-4 text-block font-bold text-ink">Выберите модель {make.name}</h1>
      <p className="mt-2 text-body text-ink-2">Показаны машины, детали с которых есть у нас на складе.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3 desktop:grid-cols-4">
        {make.models.map((model) => <Link className={tile} href={`${base}/${model.slug}`} key={model.slug}>
          {model.name}
          <Stock inStock={model.inStock} parts={model.parts} />
        </Link>)}
      </div>
    </Shell>;
  }

  const model = make.models.find((item) => item.slug === modelSlug);
  if (!model) return null;

  if (!generationSlug && model.generations.length > 1) {
    return <Shell>
      <Crumbs items={[{ href: base, label: make.name }, { href: `${base}/${model.slug}`, label: model.name }, { label: "Выберите кузов" }]} />
      <h1 className="mt-4 text-block font-bold text-ink">Выберите кузов {make.name} {model.name}</h1>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3 desktop:grid-cols-4">
        {model.generations.map((generation) => <Link className={tile} href={`${base}/${model.slug}/${generation.slug}`} key={generation.slug}>
          {generation.name}
          <Stock inStock={generation.inStock} parts={generation.parts} />
        </Link>)}
      </div>
    </Shell>;
  }

  const generation = generationSlug ? model.generations.find((item) => item.slug === generationSlug) : model.generations[0];
  if (generationSlug && !generation) return null;
  const donors = donorsOf(make, model.slug, generation?.slug);
  const title = [make.name, model.name, generation?.name].filter(Boolean).join(" ");
  const carSlug = [make.slug, model.slug, generation?.slug].filter(Boolean).join("/");
  const listing = `/search?car=${encodeURIComponent(carSlug)}`;
  // Показываем детали именно этой машины. Раньше здесь стояла лента популярных товаров
  // со всего склада — и под W212 оказывались колодки W204 и Camry.
  const own = createCatalogListing(homepage, {}, undefined, undefined, donors);
  // Фото — только своего кузова: с донора этой машины. Раньше у W213 стояло фото S-класса из модельного ряда.
  const photo = (await Promise.all(donors.slice(0, 5).map((id) => donorById(id)))).flatMap((donor) => donor?.photos ?? [])[0];

  return <Shell>
    <Crumbs items={[{ href: base, label: make.name }, { href: `${base}/${model.slug}`, label: model.name }, { label: generation?.name ?? "Детали" }]} />
    <h1 className="mt-4 text-block font-bold text-ink">Запчасти {title}</h1>
    <p className="mt-2 text-body text-ink-2">
      {generation ? `${generation.parts} ${partsWord(generation.parts)}, из них ${generation.inStock} в наличии.` : `${model.parts} ${partsWord(model.parts)}, из них ${model.inStock} в наличии.`}
    </p>
    {photo ? <div className="relative mt-4 aspect-[16/9] max-w-xl overflow-hidden rounded-ui bg-surface-2" data-car-photo><Image alt={title} className="object-cover" fill sizes="(min-width: 768px) 576px, 100vw" src={photo.preview || photo.src} /></div> : null}
    {/* Главная кнопка — заявка на подбор: не всё снятое с машины уже на сайте. */}
    <div className="mt-4 flex flex-wrap gap-2">
      <a className="inline-flex h-11 items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" data-car-request-button href="#car-request">Заявка на подбор</a>
      <Link className="inline-flex h-11 items-center rounded-ui border border-accent px-4 text-btn font-bold text-accent" href={`${listing}&availability=in_stock`}>Что в наличии</Link>
      <Link className="inline-flex h-11 items-center rounded-ui border border-line px-4 text-btn font-bold text-ink" href={listing}>Все детали</Link>
    </div>
    <RememberCar car={{ slug: carSlug, label: title }} explicit />
    {own.products.length ? <div className="mt-6 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 xl:grid-cols-4">{own.products.slice(0, 12).map((product) => <ProductCard carDonorIds={donors} key={product.id} product={product} />)}</div> : null}
    {own.total > 12 ? <Link className="mt-4 inline-flex min-h-11 items-center text-body font-bold text-accent hover:text-accent-hover" href={listing}>Все {own.total} {partsWord(own.total)} →</Link> : null}
    <div className="mt-6 scroll-mt-32" id="car-request"><DonorRequest vehicle={title} /></div>
  </Shell>;
}

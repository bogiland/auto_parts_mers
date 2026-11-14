import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DonorRequest } from "@/components/donors/DonorRequest";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProductCard } from "@/components/product/ProductCard";
import { getLiveHomepage, toStoreProduct } from "@/lib/live-catalog";
import { donorTitle, publicDonor } from "@/lib/parts-db";

type Props = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const donor = publicDonor(id);
  if (!donor) return { title: "Машина не найдена — NAA.md", robots: { index: false, follow: false } };
  const title = donorTitle(donor);
  return { title: `Запчасти с ${title} — NAA.md`, description: `Детали, снятые с ${title}${donor.engine ? `, двигатель ${donor.engine}` : ""}. Наличие и состояние уточняет оператор.` };
}

export default async function DonorPage({ params }: Props) {
  const { id } = await params;
  const donor = publicDonor(id);
  if (!donor) notFound();
  const homepage = await getLiveHomepage();
  const title = donorTitle(donor);
  const available = donor.parts.filter((part) => part.stock > 0);
  const sold = donor.parts.filter((part) => part.stock === 0);
  const facts: [string, string][] = [
    ["Марка", donor.make],
    ["Модель", [donor.model, donor.generation].filter(Boolean).join(" ")],
    ["Год", donor.year ? String(donor.year) : "не указан"],
    ["Двигатель", donor.engine || "не указан"],
    ["Пробег", donor.mileage === null ? "не указан" : `${donor.mileage.toLocaleString("ru-RU")} км`],
  ];

  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <main className="container-site section-stack">
      <section className="min-w-0">
        <p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / <Link className="hover:text-accent" href="/catalog/legkovye">Каталог</Link> / Машина-донор</p>
        <h1 className="mt-2 text-section font-bold text-ink">Запчасти с {title}</h1>
      </section>

      <section className="grid grid-cols-1 gap-6 rounded-ui bg-white p-4 shadow-card desktop:grid-cols-2 desktop:p-6">
        <div className="min-w-0">
          {donor.photos.length
            ? <div className="grid grid-cols-2 gap-2">{donor.photos.slice(0, 4).map((photo) => <div className="relative aspect-[4/3] overflow-hidden rounded-ui bg-surface-2" key={photo.src}><Image alt={title} className="object-cover" fill sizes="(min-width: 1200px) 25vw, 50vw" src={photo.src} /></div>)}</div>
            : <div className="grid aspect-[4/3] place-items-center rounded-ui bg-surface-2 text-body text-ink-2">Фото этой машины ещё не загружены</div>}
        </div>
        <div className="min-w-0">
          <h2 className="text-block font-bold text-ink">Машина</h2>
          <dl className="mt-3 flex flex-col gap-2 text-body">
            {facts.filter(([, value]) => value).map(([label, value]) => <div className="flex gap-2" key={label}><dt className="text-ink-2">{label}:</dt><dd className="min-w-0 font-medium text-ink">{value}</dd></div>)}
            <div className="flex gap-2"><dt className="text-ink-2">Деталей на складе:</dt><dd className="font-medium text-ink">{available.length}</dd></div>
          </dl>
          {donor.note && <p className="mt-4 text-body text-ink-2">{donor.note}</p>}
          <p className="mt-4 text-meta text-ink-2">Состояние каждой детали указано в её карточке. Что не выложено — спросите у оператора, он видит машину на площадке.</p>
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="text-section font-bold text-ink">Детали с этой машины</h2>
        {available.length
          ? <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 desktop:grid-cols-4">{available.map((part) => <ProductCard key={part.id} product={toStoreProduct(part)} />)}</div>
          : <p className="mt-2 text-body text-ink-2">Сейчас с этой машины ничего не выложено. Напишите, что нужно — посмотрим на месте.</p>}
        {sold.length > 0 && <p className="mt-4 text-meta text-ink-2">Ещё {sold.length} дет. с этой машины уже проданы — их страницы остаются открытыми.</p>}
      </section>

      <DonorRequest vehicle={title} />
    </main>
    <SiteFooter />
  </>;
}

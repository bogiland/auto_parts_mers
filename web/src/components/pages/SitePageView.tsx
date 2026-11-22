import Image from "next/image";
import Link from "next/link";

import { PageMap } from "@/components/pages/PageMap";
import type { CheckoutSettings } from "@/lib/checkout-db";
import { pageBlocks, type SitePage } from "@/lib/pages-db";
import { carListings } from "@/lib/car-listings";

// Один шаблон на все страницы: крошки, заголовок, текст в читаемой колонке, при необходимости фото и контакты.
export function SitePageView({ page, settings }: { page: SitePage; settings: CheckoutSettings }) {
  const blocks = pageBlocks(page.bodyRu);
  const cars = page.slug === "cars" ? carListings(page.bodyRu) : null;
  return <main className="container-site section-stack">
    <section className="min-w-0">
      <p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / {page.titleRu}</p>
      <h1 className="mt-2 text-section font-bold text-ink">{page.titleRu}</h1>
    </section>

    <section className="grid grid-cols-1 gap-6 desktop:grid-cols-3">
      {cars ? <div className="grid min-w-0 grid-cols-1 gap-4 desktop:col-span-2">
        {cars.demo && <p className="text-body text-ink-2">Примеры моделей. Наличие, комплектацию и цену уточняйте у оператора.</p>}
        {cars.listings.map((car, index) => <article key={index} className="grid min-w-0 grid-cols-1 items-start gap-4 rounded-ui border border-line bg-white p-4 shadow-card md:grid-cols-2">
          <div className="min-w-0">
            {car.image && <div className="relative aspect-[16/9] overflow-hidden rounded-ui bg-surface-2"><Image src={car.image} alt={car.name} fill unoptimized={cars.demo} sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" /></div>}
            {car.file && <a className="mt-1 block text-meta text-ink-2 underline" href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(car.file)}`}>{car.credit} · фото модели</a>}
          </div>
          <div className="min-w-0"><h2 className="text-block font-bold text-ink">{car.name}</h2><p className="mt-2 text-body font-medium text-ink">{car.specs}</p><p className="mt-2 text-body text-ink-2">{car.description}</p>
            {car.source && <a className="mt-2 block text-meta text-ink-2 underline" href={car.source}>Источник характеристик</a>}
            <a className="mt-4 inline-flex rounded-ui bg-accent px-4 py-2 text-btn font-bold text-white" href={`tel:${settings.phones.pmr}`}>Уточнить по телефону</a>
          </div>
        </article>)}
      </div> : <div className="min-w-0 rounded-ui bg-white p-4 shadow-card desktop:col-span-2 desktop:p-8">
        {page.image && <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-ui bg-surface-2">
          <Image alt={page.titleRu} className="object-cover" fill sizes="(min-width: 1200px) 760px, 100vw" src={page.image} />
        </div>}
        <div className="max-w-2xl">
          {blocks.map((block, index) => {
            if (block.kind === "heading") return <h2 className="mt-6 text-block font-bold text-ink first:mt-0" key={index}>{block.text}</h2>;
            if (block.kind === "list") return <ul className="mt-3 flex flex-col gap-2" key={index}>{block.items.map((item) => <li className="flex gap-2 text-body text-ink" key={item}><span aria-hidden="true" className="text-accent">•</span><span className="min-w-0">{item}</span></li>)}</ul>;
            if (block.kind === "note") return <p className="mt-6 rounded-ui bg-surface-2 p-3 text-meta text-ink-2" key={index}>{block.text}</p>;
            return <p className="mt-3 text-body text-ink" key={index}>{block.text}</p>;
          })}
          {!blocks.length && <p className="text-body text-ink-2">Текст этой страницы пока не заполнен.</p>}
        </div>
      </div>}

      {page.showContacts && <aside className="min-w-0">
        <div className="rounded-ui bg-white p-4 shadow-card">
          <h2 className="text-block font-bold text-ink">Связаться с нами</h2>
          <dl className="mt-4 flex flex-col gap-3 text-body">
            <div><dt className="text-meta text-ink-2">Склад и выдача</dt><dd className="text-ink">{settings.pickupAddress}</dd></div>
            <div><dt className="text-meta text-ink-2">Точка работает</dt><dd className="text-ink">{settings.pickupHours}</dd></div>
            <div><dt className="text-meta text-ink-2">Оператор отвечает</dt><dd className="text-ink">{settings.operatorHours}</dd></div>
            <div><dt className="text-meta text-ink-2">Телефон ПМР</dt><dd><a className="text-phone font-bold text-ink hover:text-accent" href={`tel:${settings.phones.pmr}`}>{settings.phones.pmr}</a></dd></div>
            <div><dt className="text-meta text-ink-2">Телефон Молдова</dt><dd><a className="text-phone font-bold text-ink hover:text-accent" href={`tel:${settings.phones.moldova}`}>{settings.phones.moldova}</a></dd></div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            {settings.messengers.viber && <a className="inline-flex h-btn items-center justify-center rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" href={settings.messengers.viber}>Написать в Viber</a>}
            {settings.messengers.telegram && <a className="inline-flex h-btn items-center justify-center rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" href={settings.messengers.telegram}>Написать в Telegram</a>}
            <Link className="inline-flex h-btn items-center justify-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href="/#expert-request">Попросить подбор</Link>
          </div>
        </div>
        <PageMap address={settings.pickupAddress} />
      </aside>}
    </section>
  </main>;
}

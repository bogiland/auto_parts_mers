import Link from "next/link";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSettings } from "@/lib/checkout-db";

/**
 * Страница «не найдено». Раньше это была стандартная чёрная английская заглушка Next —
 * человек упирался в неё без единой ссылки. Теперь здесь поиск и дорога обратно.
 */
export default async function NotFound() {
  const settings = await getSettings().catch(() => null);
  return <>
    <SiteHeader hours={settings?.operatorHours ?? ""} phone={settings?.phones.moldova ?? ""} />
    <main className="container-site section-stack pb-12 pt-4">
      <section className="rounded-ui bg-white p-4 xl:p-6">
        <h1 className="text-section font-bold text-ink">Такой страницы нет</h1>
        <p className="mt-2 text-body text-ink-2">Ссылка устарела или в адресе опечатка. Найдите деталь поиском в шапке сайта или откройте каталог.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href="/catalog/legkovye">Каталог</Link>
          <Link className="inline-flex h-btn items-center rounded-ui border border-line px-4 text-btn font-bold text-ink hover:text-accent" href="/">На главную</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}

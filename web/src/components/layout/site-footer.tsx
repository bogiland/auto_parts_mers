import Image from "next/image";
import {AdSlot} from "@/components/ads/AdSlot";
import Link from "next/link";
import { BriefcaseBusiness, ChevronDown } from "lucide-react";

import { FooterAbout } from "./FooterAbout";
import { FooterContacts } from "./FooterContacts";
import { pageLinks } from "@/lib/pages-db";
import { vacancies as openVacancies } from "@/lib/vacancies";
import type { ReactNode } from "react";

// Ссылки «О компании» и «Покупателям» берутся из раздела «Сайт → Страницы»:
// выключенная страница сразу исчезает из подвала и больше никуда не ведёт.
const categoryLinks = [["Автозапчасти", "/catalog/legkovye"], ["Автохимия и масла", "/catalog/avtohimiya"], ["Все категории", "/catalog/legkovye/categories"], ["Все марки", "/catalog/legkovye/brands"], ["Все запчасти", "/catalog/legkovye/all"]] as const;
const aboutCopy = "NAA.md — разборка автомобилей в Слободзее. Продаём б/у детали примерно с 150 машин-доноров: многие машины стоят в сборе, поэтому можно взять мотор или коробку целиком. Рядом держим новые расходники — фильтры, прокладки, масла, — которые меняют заодно с деталью. Работаем по ПМР и Молдове, говорим по-русски и по-румынски. Найдите деталь в каталоге по марке и модели или попросите подбор: оператор посмотрит, что есть на складе, назовёт состояние и итоговую сумму. Оплата при получении или переводом после подтверждения — предоплату до разговора мы не просим.";

function FooterLinkList({ links }: { links: readonly { label: string; href: string }[] }) {
  if (!links.length) return <p className="mt-3 text-body text-white/40">Раздел пока пуст.</p>;
  return <nav className="mt-3 flex flex-col gap-3">{links.map((link) => <Link className="text-body text-white/60 hover:text-white" href={link.href} key={link.href}>{link.label}</Link>)}</nav>;
}

function MobileFooterSection({ children, title }: { children: ReactNode; title: string }) {
  return <details className="group border-b border-white/10"><summary className="flex h-12 cursor-pointer list-none items-center justify-between text-accent"><span className="text-lead font-bold">{title}</span><ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={20} /></summary><div className="pb-4">{children}</div></details>;
}

export async function SiteFooter() {
  const companyLinks = [...(await pageLinks("footer-company")),{label:'Реклама на сайте',href:'/advertising'}];
  const buyerLinks = (await pageLinks("footer-buyer"));
  const categories = categoryLinks.map(([label, href]) => ({ label, href }));
  const vacancies = (await openVacancies()).length ? companyLinks.find((link) => link.href === "/vacancies") : undefined;

  return (
    <footer className="bg-header-dark pb-tabbar text-white desktop:pb-0">
      {vacancies && <section className="bg-header py-6 text-white"><div className="container-site flex flex-wrap items-center gap-4 md:gap-6"><BriefcaseBusiness aria-hidden="true" className="text-accent" size={24} /><strong className="text-body font-bold">Присоединяйтесь к команде</strong><span className="relative block h-6 w-40 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} src="/images/brand/naa-logo-transparent.png" width={863} /></span><Link className="inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href={vacancies.href}>{vacancies.label}</Link></div></section>}
      <div className="container-site"><AdSlot slot="footer" /></div>
      <FooterAbout copy={aboutCopy} />
      <div className="container-site py-8">
        <div className="hidden grid-cols-5 gap-8 desktop:grid">
          <section><Link aria-label="NAA.md" href="/"><span className="relative block h-6 w-40 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} src="/images/brand/naa-logo-transparent.png" width={863} /></span></Link><FooterLinkList links={companyLinks} /></section>
          <section><h2 className="text-lead font-bold text-accent">Покупателям</h2><FooterLinkList links={buyerLinks} /></section>
          <section><h2 className="text-lead font-bold text-accent">Категории</h2><FooterLinkList links={categories} /></section>
          <section><h2 className="text-lead font-bold text-accent">Контакты</h2><FooterContacts /></section>
          <section><h2 className="text-lead font-bold text-accent">Телефон и соцсети</h2><FooterContacts phones /></section>
        </div>
        <div className="desktop:hidden"><Link aria-label="NAA.md" className="mb-4 inline-block" href="/"><span className="relative block h-6 w-40 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} src="/images/brand/naa-logo-transparent.png" width={863} /></span></Link><MobileFooterSection title="О компании"><FooterLinkList links={companyLinks} /></MobileFooterSection><MobileFooterSection title="Покупателям"><FooterLinkList links={buyerLinks} /></MobileFooterSection><MobileFooterSection title="Категории"><FooterLinkList links={categories} /></MobileFooterSection><MobileFooterSection title="Контакты"><FooterContacts /></MobileFooterSection><FooterContacts phones /></div>
        <div className="mb-4 mt-8 flex flex-col gap-2 border-t border-white/10 py-4 text-meta text-white/40 md:flex-row md:items-center md:justify-between desktop:mb-0"><span>© 2026 NAA.md</span><span>При получении или переводом после подтверждения</span></div>
      </div>
    </footer>
  );
}

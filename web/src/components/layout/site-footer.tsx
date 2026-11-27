import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Clock3, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { AdSlot } from "@/components/ads/AdSlot";
import { getSettings } from "@/lib/checkout-db";
import { one } from "@/lib/db";
import { notDemo } from "@/lib/demo";
import { pageLinks } from "@/lib/pages-db";
import { languagesLine, messenger, storeHours } from "@/lib/store-info";

/**
 * Подвал (П9): короче, без длинного «О компании». Часы одной строкой — как в шапке и на контактах.
 * «Реклама на сайте» и вакансии — в служебных ссылках внизу. Полосы «Присоединяйтесь к команде» больше нет:
 * она висела на каждой странице, включая оформление заказа.
 */
const categoryLinks = [["Автозапчасти", "/catalog/legkovye"], ["Автохимия и масла", "/catalog/avtohimiya"], ["Все категории", "/catalog/legkovye/categories"], ["Все марки", "/catalog/legkovye/brands"]] as const;

function FooterLinkList({ links }: { links: readonly { label: string; href: string }[] }) {
  if (!links.length) return null;
  return <nav className="mt-3 flex flex-col gap-1">{links.map((link) => <Link className="flex min-h-11 items-center text-body text-white/60 hover:text-white" href={link.href} key={link.href}>{link.label}</Link>)}</nav>;
}

function MobileFooterSection({ children, title }: { children: ReactNode; title: string }) {
  return <details className="group border-b border-white/10"><summary className="flex h-12 cursor-pointer list-none items-center justify-between text-accent"><span className="text-lead font-bold">{title}</span><ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={20} /></summary><div className="pb-4">{children}</div></details>;
}

async function Contacts() {
  const settings = await getSettings();
  const phones = [["ПМР", settings.phones.pmr], ["Молдова", settings.phones.moldova]].filter(([, phone]) => phone);
  return <div className="mt-3 grid gap-2 text-body text-white/70" data-footer-contacts>
    <p className="flex gap-2"><MapPin aria-hidden="true" className="shrink-0" size={18} />{settings.pickupAddress}</p>
    <p className="flex gap-2" data-footer-hours><Clock3 aria-hidden="true" className="shrink-0" size={18} />{storeHours.full}</p>
    {phones.map(([label, phone]) => <a className="flex min-h-11 items-center hover:text-white" href={`tel:${phone.replace(/[^\d+]/g, "")}`} key={label}>{label}: {phone}</a>)}
    <div className="flex flex-wrap gap-2">
      <a className="inline-flex h-11 items-center rounded-ui bg-white/10 px-4 font-bold text-white hover:bg-white/20" data-footer-viber href={messenger.viber}>Viber</a>
      <a className="inline-flex h-11 items-center rounded-ui bg-white/10 px-4 font-bold text-white hover:bg-white/20" data-footer-telegram href={messenger.telegram} rel="noreferrer" target="_blank">Telegram</a>
      <span className="self-center text-meta">{messenger.label}</span>
    </div>
    <p className="text-meta text-white/60">{languagesLine}</p>
  </div>;
}

export async function SiteFooter() {
  const [companyLinks, buyerLinks, published] = await Promise.all([
    pageLinks("footer-company"), pageLinks("footer-buyer"),
    one<{ n: string }>(`SELECT COUNT(*) AS n FROM product_reviews WHERE status = 'published' AND ${notDemo()}`).catch(() => null),
  ]);
  // Отзывы — в подвале, только когда есть хоть один опубликованный: пустой раздел не показываем.
  const reviews = Number(published?.n ?? 0) > 0 ? [{ label: "Отзывы", href: "/reviews" }] : [];
  const company = [...companyLinks.filter((link) => link.href !== "/vacancies"), ...reviews];
  const categories = categoryLinks.map(([label, href]) => ({ label, href }));
  const service = [{ label: "Реклама на сайте", href: "/advertising" }, ...companyLinks.filter((link) => link.href === "/vacancies")];
  const logo = <span className="relative block h-6 w-40 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} src="/images/brand/naa-logo-transparent.png" width={863} /></span>;

  return (
    <footer className="bg-header-dark pb-tabbar text-white desktop:pb-0">
      <div className="container-site"><AdSlot slot="footer" /></div>
      <div className="container-site py-8">
        <p className="max-w-3xl text-body text-white/60">Разборка автомобилей в Слободзее: б/у детали с машин-доноров и новые расходники. Доставка по ПМР и Молдове.</p>
        <div className="mt-6 hidden grid-cols-4 gap-8 desktop:grid">
          <section><Link aria-label="NAA.md" className="inline-flex h-11 items-center" href="/">{logo}</Link><FooterLinkList links={company} /></section>
          <section><h2 className="text-lead font-bold text-accent">Покупателям</h2><FooterLinkList links={buyerLinks} /></section>
          <section><h2 className="text-lead font-bold text-accent">Категории</h2><FooterLinkList links={categories} /></section>
          <section><h2 className="text-lead font-bold text-accent">Контакты</h2><Contacts /></section>
        </div>
        <div className="mt-6 desktop:hidden">
          <Link aria-label="NAA.md" className="mb-4 inline-flex h-11 items-center" href="/">{logo}</Link>
          <Contacts />
          <MobileFooterSection title="О компании"><FooterLinkList links={company} /></MobileFooterSection>
          <MobileFooterSection title="Покупателям"><FooterLinkList links={buyerLinks} /></MobileFooterSection>
          <MobileFooterSection title="Категории"><FooterLinkList links={categories} /></MobileFooterSection>
        </div>
        <div className="mb-4 mt-8 flex flex-col gap-2 border-t border-white/10 py-4 text-meta text-white/40 md:flex-row md:items-center md:justify-between desktop:mb-0">
          <span>© 2026 NAA.md</span>
          <nav aria-label="Служебные ссылки" className="flex flex-wrap gap-4" data-footer-service>{service.map((link) => <Link className="flex min-h-11 items-center hover:text-white" href={link.href} key={link.href}>{link.label}</Link>)}</nav>
        </div>
      </div>
    </footer>
  );
}

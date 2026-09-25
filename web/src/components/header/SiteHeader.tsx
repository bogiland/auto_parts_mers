import { ChevronDown, Heart, MapPin, MessageCircle, Phone, Send, ShoppingCart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CatalogButton } from "./CatalogButton";
import { HeaderSearch } from "./HeaderSearch";
import { MobileTabBar } from "./MobileTabBar";

interface SiteHeaderProps {
  hours: string;
  phone: string;
}

const desktopNavigation = [
  ["Легковые запчасти", "/catalog/legkovye"],
  ["Автохимия", "/catalog/avtohimiya"],
  ["Масла", "/catalog/avtohimiya"],
  ["Аккумуляторы", "/catalog/legkovye/elektrooborudovanie"],
  ["Автосервис", "/autoservice"],
  ["Русификация", "/russification"],
  ["Автомобили в наличии", "/cars"],
  ["Акции", "/promotions"],
] as const;

const mobileNavigation = [
  ["Акции", "/promotions"],
  ["Легковые запчасти", "/catalog/legkovye"],
  ["Автохимия", "/catalog/avtohimiya"],
  ["Масла", "/catalog/avtohimiya"],
  ["Аккумуляторы", "/catalog/legkovye/elektrooborudovanie"],
  ["Автосервис", "/autoservice"],
  ["Русификация", "/russification"],
  ["Автомобили в наличии", "/cars"],
] as const;

function HeaderAction({ href, icon, label, badge = false }: { href: string; icon: ReactNode; label: string; badge?: boolean }) {
  return <Link aria-label={label} className="flex w-14 shrink-0 flex-col items-center gap-1 text-meta font-medium text-white hover:text-accent" href={href}><span className="relative">{icon}{badge ? <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-badge bg-accent text-badge font-bold text-white">0</span> : null}</span><span>{label}</span></Link>;
}

export function SiteHeader({ hours, phone }: SiteHeaderProps) {
  return (
    <header className="bg-header xl:contents">
      <div className="xl:hidden">
        <div className="container-site flex h-10 items-center justify-between bg-header text-nav font-bold text-white">
          <Link className="flex items-center gap-1" href="/contacts"><MapPin aria-hidden="true" size={16} /><span>Слободзея</span><ChevronDown aria-hidden="true" size={14} /></Link>
          <a aria-label={`Позвонить ${phone}`} href="tel:+37368123456"><Phone aria-hidden="true" size={20} /></a>
        </div>
        <div className="sticky top-0 z-40 bg-header px-4 py-2">
          <div className="container-site flex min-w-0 gap-2 px-0"><CatalogButton mobile /><HeaderSearch mobile /></div>
        </div>
        <nav aria-label="Разделы каталога" className="scroller-x h-9 items-center gap-6 bg-header px-4 text-nav font-medium text-white" data-scroller>
          {mobileNavigation.map(([label, href]) => <Link className={label === "Акции" ? "font-bold text-sale" : "shrink-0 hover:text-accent"} href={href} key={label}>{label}</Link>)}
        </nav>
      </div>

      <div className="hidden xl:contents">
        <div className="bg-header-top">
          <div className="container-site flex h-11 items-center justify-between py-2 text-nav text-white">
            <div className="flex min-w-0 items-center gap-4">
              <Link className="flex items-center gap-1 font-bold" href="/contacts"><MapPin aria-hidden="true" size={16} />Слободзея<ChevronDown aria-hidden="true" size={14} /></Link>
              <Link href="/about">О компании</Link><Link href="/delivery">Доставка</Link><Link href="/contacts">Контакты</Link><Link href="/vacancies">Вакансии</Link>
            </div>
            <div className="flex shrink-0 items-center gap-4"><a aria-label="Telegram" href="#telegram"><Send aria-hidden="true" size={20} /></a><a aria-label="Viber" href="#viber"><MessageCircle aria-hidden="true" size={20} /></a><a className="text-phone font-bold" href="tel:+37368123456" title={hours}>{phone}</a></div>
          </div>
        </div>
        <div className="sticky top-0 z-40 bg-header py-3">
          <div className="container-site flex min-w-0 items-center gap-4">
            <Link aria-label="NAA.md, главная" className="shrink-0" href="/"><Image alt="NAA.md" className="h-[22px] w-auto" height={22} priority src="/images/brand/naa-logo.png" width={120} /></Link>
            <CatalogButton />
            <HeaderSearch />
            <div className="flex shrink-0 items-start gap-4"><HeaderAction href="/account" icon={<UserRound aria-hidden="true" size={24} strokeWidth={1.8} />} label="Войти" /><HeaderAction href="/favorites" icon={<Heart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Избранное" /><HeaderAction badge href="/cart" icon={<ShoppingCart aria-hidden="true" size={24} strokeWidth={1.8} />} label="Корзина" /></div>
          </div>
        </div>
        <nav aria-label="Основная навигация" className="h-9 bg-header">
          <div className="container-site flex h-full items-center justify-between gap-4">{desktopNavigation.map(([label, href]) => <Link className={label === "Акции" ? "text-nav font-bold text-sale" : "text-nav text-white hover:text-accent"} href={href} key={label}>{label}</Link>)}</div>
        </nav>
      </div>
      <MobileTabBar />
    </header>
  );
}

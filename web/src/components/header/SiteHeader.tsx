import { ChevronDown, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { SearchBox, SearchBoxFallback } from "@/components/search/SearchBox";

import { CatalogButton } from "./CatalogButton";
import { DesktopMainRow } from "./DesktopMainRow";
import { MobileTabBar } from "./MobileTabBar";

interface SiteHeaderProps {
  hours: string;
  phone: string;
}

const navigation = [
  ["Легковые запчасти", "/catalog/legkovye"],
  ["Автохимия", "/catalog/avtohimiya"],
  ["Автосервис", "/autoservice"],
  ["Русификация", "/russification"],
  ["Автомобили в наличии", "/cars"],
  ["Акции", "/promotions"],
] as const;

export function SiteHeader({ hours, phone }: SiteHeaderProps) {
  return (
    <header>
      <div className="desktop:hidden">
        <div className="header-mobile-row bg-header">
          <div className="container-site flex h-full min-w-0 items-center justify-between">
            <CatalogButton mobile />
            <Link aria-label="NAA.md, главная" className="min-w-0" href="/">
              <Image alt="NAA.md" className="h-7 w-auto object-contain" height={28} priority src="/images/brand/naa-logo.png" width={160} />
            </Link>
            <a aria-label={`Позвонить ${phone}`} className="grid h-10 w-10 place-items-center rounded-ui text-white hover:bg-white/10" href="tel:+37368123456">
              <Phone aria-hidden="true" size={20} />
            </a>
          </div>
        </div>
        <div className="sticky top-0 z-40 bg-header">
          <div className="container-site flex min-w-0 items-center">
            <Suspense fallback={<SearchBoxFallback mobile />}><SearchBox mobile /></Suspense>
          </div>
        </div>
        <nav aria-label="Разделы каталога" className="header-mobile-nav scroller-x h-9 items-center bg-header px-4 text-nav font-medium text-white" data-scroller>
          {navigation.map(([label, href]) => <Link className={label === "Акции" ? "shrink-0 font-bold text-accent" : "shrink-0 hover:text-accent"} href={href} key={label}>{label}</Link>)}
        </nav>
      </div>

      <div className="hidden desktop:block">
        <div className="bg-header-dark py-2">
          <div className="container-site flex min-w-0 items-center justify-between text-body text-white">
            <div className="flex min-w-0 items-center">
              <Link className="flex shrink-0 items-center gap-1 font-bold" href="/contacts"><MapPin aria-hidden="true" size={16} />Слободзея<ChevronDown aria-hidden="true" size={14} /></Link>
              <nav aria-label="Информация о компании" className="header-top-links flex min-w-0 items-center gap-4 text-white/60">
                <Link className="hover:text-white" href="/about">О компании</Link>
                <Link className="hover:text-white" href="/delivery">Доставка</Link>
                <Link className="hover:text-white" href="/contacts">Контакты</Link>
                <Link className="hover:text-white" href="/vacancies">Вакансии</Link>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-white/60">
              <a aria-label="Telegram" className="hover:text-white" href="#telegram"><Send aria-hidden="true" size={18} /></a>
              <a aria-label="WhatsApp" className="hover:text-white" href="#whatsapp"><MessageCircle aria-hidden="true" size={18} /></a>
              <a className="text-lead font-bold text-white" href="tel:+37368123456" title={hours}>{phone}</a>
            </div>
          </div>
        </div>
        <div className="bg-header">
          <DesktopMainRow hours={hours} />
          <nav aria-label="Основная навигация" className="container-site flex h-9 items-center justify-between gap-4 pb-3 text-body text-white">
            {navigation.map(([label, href]) => <Link className={label === "Акции" ? "font-bold text-accent" : "hover:text-accent"} href={href} key={label}>{label}</Link>)}
          </nav>
        </div>
      </div>
      <MobileTabBar />
    </header>
  );
}

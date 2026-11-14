import { ChevronDown, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { SearchBox, SearchBoxFallback } from "@/components/search/SearchBox";
import { headerLinks, pageLinks } from "@/lib/pages-db";
import { currentCustomer } from "@/lib/customer-auth";

import { CatalogButton } from "./CatalogButton";
import { DesktopMainRow } from "./DesktopMainRow";
import { MobileTabBar } from "./MobileTabBar";

interface SiteHeaderProps {
  hours: string;
  phone: string;
}

// Разделы каталога заданы маршрутами, остальные пункты меню берутся из «Сайт → Страницы»:
// выключенная страница сразу исчезает из шапки.
const catalogLinks = [{ label: "Легковые запчасти", href: "/catalog/legkovye" }, { label: "Автохимия", href: "/catalog/avtohimiya" }];

export async function SiteHeader({ hours, phone }: SiteHeaderProps) {
  // Вошедший покупатель видит своё имя вместо «Войти» и попадает сразу в кабинет.
  const customer = await currentCustomer();
  const account = { label: customer ? customer.name : "Войти", href: customer ? "/account" : "/login" };
  const navigation = [...catalogLinks, ...pageLinks("nav")];
  const topLinks = headerLinks();
  const contacts = topLinks.find((link) => link.href === "/contacts");
  return (
    <header>
      <div className="desktop:hidden">
        <div className="header-mobile-row bg-header">
          <div className="container-site flex h-full min-w-0 items-center justify-between">
            <CatalogButton mobile />
            <Link aria-label="NAA.md, главная" className="min-w-0" href="/">
              <span className="relative block h-6 w-32 overflow-hidden"><Image alt="NAA.md" className="absolute top-1/2 h-auto w-full -translate-y-1/2" height={289} priority src="/images/brand/naa-logo-transparent.png" width={863} /></span>
            </Link>
            <Link aria-label={phone ? `Позвонить ${phone}` : "Оставить заявку"} className="grid h-10 w-10 place-items-center rounded-ui text-white hover:bg-white/10" href={phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "/#expert-request"}>
              <Phone aria-hidden="true" size={20} />
            </Link>
          </div>
        </div>
        <div className="sticky top-0 z-40 bg-header">
          <div className="container-site flex min-w-0 items-center">
            <Suspense fallback={<SearchBoxFallback mobile />}><SearchBox mobile /></Suspense>
          </div>
        </div>
        <nav aria-label="Разделы каталога" className="header-mobile-nav scroller-x h-9 items-center bg-header px-4 text-nav font-medium text-white" data-scroller>
          {navigation.map((link) => <Link className={link.label === "Акции" ? "shrink-0 font-bold text-accent" : "shrink-0 hover:text-accent"} href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
      </div>

      <div className="hidden desktop:block">
        <div className="bg-header-dark py-2">
          <div className="container-site flex min-w-0 items-center justify-between text-body text-white">
            <div className="flex min-w-0 items-center">
              {contacts
                ? <Link className="flex shrink-0 items-center gap-1 font-bold" href={contacts.href}><MapPin aria-hidden="true" size={16} />Слободзея<ChevronDown aria-hidden="true" size={14} /></Link>
                : <span className="flex shrink-0 items-center gap-1 font-bold"><MapPin aria-hidden="true" size={16} />Слободзея</span>}
              <nav aria-label="Информация о компании" className="header-top-links flex min-w-0 items-center gap-4 text-white/60">
                {topLinks.map((link) => <Link className="hover:text-white" href={link.href} key={link.href}>{link.label}</Link>)}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-white/60">
              {phone ? <a className="text-lead font-bold text-white" href={`tel:${phone.replace(/[^\d+]/g, "")}`} title={hours}>{phone}</a> : <Link className="text-lead font-bold text-white" href="/#expert-request">Помощь эксперта</Link>}
            </div>
          </div>
        </div>
        <div className="bg-header">
          <DesktopMainRow account={account} hours={hours} />
          <nav aria-label="Основная навигация" className="container-site flex h-9 items-center justify-between gap-4 pb-3 text-body text-white">
            {navigation.map((link) => <Link className={link.label === "Акции" ? "font-bold text-accent" : "hover:text-accent"} href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
        </div>
      </div>
      <MobileTabBar account={account} />
    </header>
  );
}

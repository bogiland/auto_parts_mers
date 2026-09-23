import { Heart, MapPin, Search, ShoppingCart, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { IconAction } from "@/components/ui/icon-action";

interface SiteHeaderProps {
  hours: string;
  phone: string;
}

export function SiteHeader({ hours, phone }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__utility">
        <div className="page-shell site-header__utility-inner">
          <div><a href="/contacts"><MapPin aria-hidden="true" size={13} />Слободзея</a><a href="/about">О компании</a><a href="/delivery">Доставка</a><a href="/vacancies">Вакансии</a></div>
        </div>
      </div>
      <div className="page-shell site-header__inner">
        <Link className="brand" href="/" aria-label="NAA.md, главная"><Image alt="" className="brand__image" height={66} priority src="/images/brand/naa-logo.png" width={360} /></Link>
        <form className="site-search" role="search" action="/catalog">
          <label className="sr-only" htmlFor="catalog-search">Поиск по каталогу</label>
          <input id="catalog-search" name="q" placeholder="Поиск по коду детали, модели или категории..." type="search" />
          <button aria-label="Искать" type="submit"><Search size={20} strokeWidth={1.8} /></button>
        </form>
        <div className="header-actions">
          <IconAction href="/account" icon={<UserRound size={21} strokeWidth={1.7} />} label="Мой аккаунт" />
          <IconAction href="/favorites" icon={<Heart size={21} strokeWidth={1.7} />} label="Избранное" />
          <IconAction href="/cart" icon={<ShoppingCart size={21} strokeWidth={1.7} />} label="Корзина" badge={0} />
        </div>
        <div className="header-contact">
          <div><a href="tel:+37368123456">{phone}</a><span>{hours}</span></div>
          <div className="locale-switcher" aria-label="Выбор языка"><Link aria-current="page" href="/">RU</Link><span>/</span><a href="/ro/">RO</a></div>
        </div>
      </div>
    </header>
  );
}

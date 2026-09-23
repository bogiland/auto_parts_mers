"use client";

import {
  Armchair,
  Bolt,
  CarFront,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CircleGauge,
  Cog,
  Disc3,
  Filter,
  Grid2X2,
  Sparkles,
  Thermometer,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const navigationItems = [["Автосервис", "/autoservice"], ["Автомойка", "/carwash"], ["Русификация", "/russification"], ["Автомобили в наличии", "/cars"]] as const;

const catalogItems = [
  { icon: CircleGauge, label: "Двигатель и компоненты", href: "/catalog/engine", children: ["Двигатели", "ГБЦ и клапанный механизм", "Прокладки и сальники", "Система смазки"] },
  { icon: Disc3, label: "Тормозная система", href: "/catalog/brakes", children: ["Тормозные колодки", "Тормозные диски", "Суппорты", "Тормозные шланги"] },
  { icon: Wrench, label: "Подвеска и рулевое управление", href: "/catalog/suspension", children: ["Амортизаторы и стойки", "Рычаги подвески", "Шаровые опоры", "Рулевые тяги"] },
  { icon: Cog, label: "Трансмиссия и коробка передач", href: "/catalog/transmission", children: ["АКПП и МКПП", "Сцепление", "Приводы и ШРУС", "Редукторы"] },
  { icon: Bolt, label: "Электрооборудование", href: "/catalog/electrical", children: ["Аккумуляторы", "Генераторы", "Стартеры", "Датчики"] },
  { icon: Thermometer, label: "Охлаждение и отопление", href: "/catalog/cooling", children: ["Радиаторы", "Термостаты", "Водяные насосы", "Вентиляторы"] },
  { icon: CarFront, label: "Кузов и экстерьер", href: "/catalog/body", children: ["Бамперы", "Фары", "Зеркала", "Кузовные детали"] },
  { icon: Armchair, label: "Интерьер и комфорт", href: "/catalog/interior", children: ["Сиденья", "Панели салона", "Климат-контроль", "Стеклоподъёмники"] },
  { icon: Wind, label: "Выхлопная система", href: "/catalog/exhaust", children: ["Глушители", "Катализаторы", "Лямбда-зонды", "Крепления"] },
  { icon: Filter, label: "Фильтры и расходники", href: "/catalog/filters", children: ["Масляные фильтры", "Воздушные фильтры", "Топливные фильтры", "Масла и жидкости"] },
  { icon: CircleDot, label: "Подшипники и крепёжные элементы", href: "/catalog/bearings", children: ["Ступичные подшипники", "Ролики", "Болты и гайки", "Крепления"] },
  { icon: Sparkles, label: "Аксессуары и тюнинг", href: "/catalog/accessories", children: ["Коврики", "Защита кузова", "Освещение", "Аксессуары салона"] },
] as const;

export function SecondaryNav() {
  const [isCatalogOpen, setCatalogOpen] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);

  function closeCatalog() {
    setCatalogOpen(false);
    setActiveCategoryIndex(null);
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCatalog();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const activeCategory = activeCategoryIndex === null ? null : catalogItems[activeCategoryIndex];

  return (
    <nav className="secondary-nav" aria-label="Основная навигация">
      {isCatalogOpen ? <button aria-label="Закрыть каталог" className="catalog-overlay" onClick={closeCatalog} type="button" /> : null}
      <div className="secondary-nav__viewport">
        <div className="page-shell">
          <div className="secondary-nav__inner">
            <button aria-expanded={isCatalogOpen} aria-haspopup="dialog" className="secondary-nav__link secondary-nav__catalog-trigger" onClick={() => { setCatalogOpen((isOpen) => !isOpen); setActiveCategoryIndex(null); }} type="button"><Grid2X2 aria-hidden="true" size={15} />Каталог запчастей</button>
            {navigationItems.map(([label, href]) => <a className="secondary-nav__link" href={href} key={href}>{label}</a>)}
          </div>
        </div>
      </div>
      {isCatalogOpen ? (
        <section aria-label="Каталог запчастей" className="catalog-drawer" role="dialog">
          <div className="catalog-drawer__primary">
            <div className="catalog-drawer__header"><a href="/catalog" onClick={closeCatalog}>Все категории</a><button aria-label="Закрыть каталог" onClick={closeCatalog} type="button"><X size={20} /></button></div>
            <div className="catalog-drawer__list">
              {catalogItems.map((item, index) => {
                const Icon = item.icon;
                return <button className={activeCategoryIndex === index ? "is-active" : undefined} key={item.href} onClick={() => setActiveCategoryIndex(index)} type="button"><Icon aria-hidden="true" size={17} /><span>{item.label}</span><ChevronRight aria-hidden="true" size={16} /></button>;
              })}
            </div>
            <a className="catalog-drawer__mercedes" href="/catalog/mercedes" onClick={closeCatalog}>Оригинальные детали Mercedes-Benz</a>
          </div>
          {activeCategory ? <div className="catalog-drawer__secondary"><div className="catalog-drawer__header"><button className="catalog-drawer__back" onClick={() => setActiveCategoryIndex(null)} type="button"><ChevronLeft size={18} />Назад</button></div><a className="catalog-drawer__category-link" href={activeCategory.href} onClick={closeCatalog}>{activeCategory.label}</a><div className="catalog-drawer__children">{activeCategory.children.map((child) => <a href={activeCategory.href} key={child} onClick={closeCatalog}>{child}</a>)}</div></div> : null}
        </section>
      ) : null}
    </nav>
  );
}

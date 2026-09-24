"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const catalogItems = [
  ["Двигатель и компоненты", "/catalog/legkovye/dvigatel"],
  ["Тормозная система", "/catalog/legkovye/tormoza"],
  ["Подвеска и рулевое управление", "/catalog/legkovye/podveska"],
  ["Трансмиссия и коробка передач", "/catalog/legkovye/transmissiya"],
  ["Электрооборудование", "/catalog/legkovye/elektrooborudovanie"],
  ["Охлаждение и отопление", "/catalog/legkovye/ohlazhdenie"],
  ["Кузов и экстерьер", "/catalog/legkovye/kuzov"],
  ["Интерьер и комфорт", "/catalog/legkovye/interer"],
  ["Выхлопная система", "/catalog/legkovye/vyhlop"],
  ["Фильтры и расходники", "/catalog/legkovye/filtry"],
  ["Подшипники и крепёжные элементы", "/catalog/legkovye/podshipniki"],
  ["Аксессуары и тюнинг", "/catalog/legkovye/aksessuary"],
] as const;

interface CatalogButtonProps {
  mobile?: boolean;
  navigation?: boolean;
}

export function CatalogButton({ mobile = false, navigation = false }: CatalogButtonProps) {
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const className = mobile
    ? "grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-accent text-white hover:bg-accent-hover"
    : navigation
      ? "shrink-0 text-nav font-bold text-white hover:text-accent"
      : "flex h-control shrink-0 items-center gap-2 rounded-ui bg-accent px-5 text-lead font-bold text-white hover:bg-accent-hover";

  return (
    <>
      <button aria-expanded={isOpen} aria-haspopup="dialog" aria-label={mobile ? "Открыть каталог" : undefined} className={className} onClick={() => setOpen(true)} type="button">
        <Menu aria-hidden="true" size={20} />
        {mobile ? null : "Каталог"}
      </button>
      {isOpen ? (
        <>
          <button aria-label="Закрыть каталог" className="fixed inset-0 z-40 bg-ink/60" onClick={() => setOpen(false)} type="button" />
          <section aria-label="Каталог запчастей" className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-full flex-col bg-surface shadow-card" role="dialog">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Link className="text-body font-bold text-ink" href="/catalog/legkovye" onClick={() => setOpen(false)}>Все категории</Link>
              <button aria-label="Закрыть каталог" className="grid h-10 w-10 place-items-center text-ink-2 hover:text-accent" onClick={() => setOpen(false)} type="button"><X size={20} /></button>
            </div>
            <nav className="min-w-0 flex-1 overflow-y-auto py-2" aria-label="Категории каталога">
              {catalogItems.map(([label, href]) => <Link className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-body font-bold text-ink-2 hover:bg-surface-2 hover:text-ink" href={href} key={href} onClick={() => setOpen(false)}><span>{label}</span><ChevronRight aria-hidden="true" className="shrink-0 text-muted-2" size={16} /></Link>)}
            </nav>
            <Link className="border-t border-line px-4 py-4 text-meta font-bold text-ink hover:bg-surface-2" href="/catalog/legkovye" onClick={() => setOpen(false)}>Оригинальные детали Mercedes-Benz</Link>
          </section>
        </>
      ) : null}
    </>
  );
}

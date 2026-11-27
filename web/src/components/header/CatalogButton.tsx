"use client";

import { ChevronDown, ChevronRight, Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { categoryBasePath, categoryHref } from "@/data/directions.seed";
import type { PublicCategory } from "@/lib/reference-db";
import { languagesLine, messenger, storeHours } from "@/lib/store-info";

/**
 * Меню берёт разделы только из справочника владельца — из того же источника,
 * что главная и фильтры каталога. Раньше здесь лежал свой список из двенадцати
 * пунктов, и в меню было одно дерево категорий, а на главной другое.
 *
 * Пока справочник пуст, меню не показывает выдуманных разделов: вместо них —
 * одна ссылка на каталог целиком.
 */

interface CatalogButtonProps {
  mobile?: boolean;
  categories: PublicCategory[];
  /** Телефон для бургер-меню на мобильном. */
  phone?: string;
}

export function CatalogButton({ mobile = false, categories, phone = "" }: CatalogButtonProps) {
  const [isOpen, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelId = useId();
  const items = categories.map(category => ({
    label: category.name,
    href: categoryHref(category.slug),
    base: categoryBasePath(category.slug),
    children: category.children as { id: string; slug: string; name: string }[],
  }));
  const selected = items.find(item => item.href === expanded);
  const subcategories = (item: typeof items[number]) => <ul className="grid gap-1 p-2">
    {item.children.map(child => <li key={child.id}><Link className="block rounded-ui px-4 py-2 text-body text-ink hover:bg-surface-2" href={`${item.base}/${child.slug}`} onClick={() => setOpen(false)}>{child.name}</Link></li>)}
  </ul>;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const className = mobile
    ? "grid h-11 w-11 shrink-0 place-items-center rounded-ui text-white hover:bg-white/10"
    : "flex h-control shrink-0 items-center gap-2 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover";

  return (
    <>
      <button aria-expanded={isOpen} aria-haspopup="dialog" aria-label={mobile ? "Открыть каталог" : undefined} className={className} onClick={() => { setExpanded(null); setOpen(true); }} type="button">
        <Menu aria-hidden="true" size={20} />
        {mobile ? null : "Каталог"}
      </button>
      {isOpen ? (
        <>
          <button aria-label="Закрыть каталог" className="fixed inset-0 z-40 bg-ink/60" onClick={() => setOpen(false)} type="button" />
          <section aria-label="Каталог запчастей" className={`fixed inset-y-0 left-0 z-50 flex max-w-full flex-col bg-surface shadow-card ${mobile ? "w-full" : "w-80"}`} role="dialog">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Link className="text-body font-bold text-ink" href="/catalog/legkovye" onClick={() => setOpen(false)}>Все категории</Link>
              <button aria-label="Закрыть каталог" className="grid h-10 w-10 place-items-center text-ink-2 hover:text-accent" onClick={() => setOpen(false)} type="button"><X size={20} /></button>
            </div>
            <nav className="min-w-0 flex-1 overflow-y-auto py-2" aria-label="Категории каталога">
              {items.length ? null : <p className="px-4 py-3 text-body text-ink-2">Разделы каталога ещё не заведены. <Link className="text-accent hover:underline" href="/catalog/legkovye" onClick={() => setOpen(false)}>Открыть каталог целиком</Link></p>}
              {items.map(item => {
                const open = expanded === item.href;
                return <div key={item.href}>
                  <div className={`flex items-center ${open ? "bg-surface-2" : ""}`}>
                    <Link className="min-w-0 flex-1 px-4 py-3 text-body font-bold text-ink hover:bg-surface-2" href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
                    {item.children.length > 0 && <button type="button" className="grid h-12 w-12 shrink-0 place-items-center text-ink hover:bg-surface-2" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={`${open ? "Свернуть" : "Раскрыть"} подкатегории: ${item.label}`} onClick={() => setExpanded(open ? null : item.href)}>{open ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}</button>}
                  </div>
                  {mobile && open && <div id={panelId} className="bg-surface-2 pl-4">{subcategories(item)}</div>}
                </div>;
              })}
            </nav>
            {!mobile && selected && <div id={panelId} className="absolute inset-y-0 left-full w-80 overflow-y-auto border-l border-line bg-surface shadow-card"><h2 className="px-4 py-4 text-block font-bold text-ink">{selected.label}</h2>{subcategories(selected)}</div>}
            <div className="grid gap-1 border-t border-line p-2" data-burger-service>
              {phone ? <a className="flex h-11 items-center gap-2 rounded-ui px-2 text-body font-bold text-ink hover:bg-surface-2" href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" size={18} />{phone}</a> : null}
              <div className="grid grid-cols-3 gap-1">
                {[["Доставка", "/delivery"], ["Оплата", "/payment"], ["Контакты", "/contacts"]].map(([label, href]) => <Link className="flex h-11 items-center justify-center rounded-ui bg-surface-2 text-body text-ink hover:text-accent" href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>)}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <a className="flex h-11 items-center justify-center rounded-ui border border-line text-body font-bold text-ink" href={messenger.viber}>Viber</a>
                <a className="flex h-11 items-center justify-center rounded-ui border border-line text-body font-bold text-ink" href={messenger.telegram} rel="noreferrer" target="_blank">Telegram</a>
              </div>
              <p className="px-2 text-meta text-ink-2">{storeHours.full}. {languagesLine}.</p>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

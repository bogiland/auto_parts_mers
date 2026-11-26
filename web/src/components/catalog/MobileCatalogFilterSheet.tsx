"use client";

// Клиентский компонент: открывается и закрывается кнопками без перезагрузки страницы.
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { CatalogFilterForm } from "@/components/catalog/CatalogFilterSidebar";

/**
 * Фильтры на телефоне. Одна кнопка внизу — «Показать N»: она и применяет фильтр,
 * и закрывает панель. Прежние «Готово» сверху и «Применить» снизу делали разное,
 * и «Готово» закрывало панель, не применив выбранное.
 */
export function MobileCatalogFilterSheet(props: Omit<ComponentProps<typeof CatalogFilterForm>, "onDone">) {
  function closeSheet() {
    document.getElementById("catalog-filter-sheet")?.removeAttribute("open");
  }

  return <details className="lg:hidden" id="catalog-filter-sheet">
    <summary className="sr-only">Открыть фильтры</summary>
    <button aria-label="Закрыть фильтры" className="fixed inset-0 z-40 bg-ink/40" onClick={closeSheet} type="button" />
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-screen overflow-y-auto rounded-t-ui bg-white p-4 pb-tabbar">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lead font-bold text-ink">Фильтры</h2>
        <button aria-label="Закрыть фильтры" className="grid h-10 w-10 place-items-center text-ink-2 hover:text-accent" onClick={closeSheet} type="button"><X aria-hidden="true" size={20} /></button>
      </div>
      <CatalogFilterForm {...props} onDone={closeSheet} />
    </div>
  </details>;
}

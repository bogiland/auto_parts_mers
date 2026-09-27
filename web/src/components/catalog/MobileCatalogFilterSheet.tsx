"use client";

import type { ReactNode } from "react";

export function MobileCatalogFilterSheet({ children }: { children: ReactNode }) {
  function closeSheet() {
    document.getElementById("catalog-filter-sheet")?.removeAttribute("open");
  }

  return <details className="lg:hidden" id="catalog-filter-sheet"><summary className="sr-only">Открыть фильтры</summary><button aria-label="Закрыть фильтры" className="fixed inset-0 z-40 bg-ink/40" onClick={closeSheet} type="button" /><div className="fixed inset-x-0 bottom-0 z-50 max-h-screen overflow-y-auto rounded-t-ui bg-white p-4 pb-tabbar"><div className="mb-4 flex items-center justify-between"><h2 className="text-lead font-bold text-ink">Фильтры</h2><button className="text-body text-accent" onClick={closeSheet} type="button">Готово</button></div>{children}</div></details>;
}

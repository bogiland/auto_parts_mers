"use client";

// Клиентский компонент: следит за нажатиями ссылок и сменой адреса — это происходит только в браузере.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Индикатор загрузки при переходе (П9): тонкая полоса сверху, пока открывается следующая страница.
 * Страницы каталога собираются на сервере, и без индикатора казалось, что нажатие не сработало.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Запоминаем адрес, с которого ушли по ссылке: пока он совпадает с текущим, страница ещё грузится.
  // Как только адрес сменился, полоса пропадает сама — без setState в эффекте.
  const current = `${pathname}?${searchParams.toString()}`;
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setLeaving(`${location.pathname}?${new URLSearchParams(location.search).toString()}`);
    }
    // «Назад» и «Вперёд» могут вернуть на адрес, с которого уходили, — полосу сбрасываем.
    function onPop() { setLeaving(null); }
    // Фаза перехвата: Link из Next отменяет обычный переход (preventDefault) раньше, чем щелчок дойдёт до document.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("popstate", onPop); };
  }, []);

  if (leaving === null || leaving !== current) return null;
  return <div aria-label="Загрузка страницы" className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-accent/20" data-nav-progress role="progressbar">
    <div className="h-full w-1/3 animate-pulse bg-accent" />
  </div>;
}

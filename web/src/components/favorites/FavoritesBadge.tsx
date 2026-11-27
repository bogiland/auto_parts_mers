"use client";

// Клиентский компонент: избранное хранится в браузере, счётчик обновляется без перезагрузки.
import { useFavorites } from "@/lib/favorites-store";

/** Счётчик избранного в шапке (П9) — как у корзины. */
export function FavoritesBadge({ mobile = false }: { mobile?: boolean }) {
  const count = useFavorites().length;
  if (!count) return null;
  return <span className={mobile ? "absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-badge bg-accent px-1 text-badge font-bold text-white" : "absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-badge font-bold text-white"} data-favorites-count>{count}</span>;
}

"use client";

import { Heart } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/lib/favorites-store";

export function FavoriteButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const selected = useFavorites().includes(id);
  return <button
    aria-label={selected ? `Убрать ${name} из избранного` : `Добавить ${name} в избранное`}
    aria-pressed={selected}
    className={`${className} grid place-items-center ${selected ? "text-accent" : "text-ink-3 hover:text-accent"}`}
    onClick={() => toggleFavorite(id)}
    type="button"
  ><Heart aria-hidden="true" fill={selected ? "currentColor" : "none"} size={20} strokeWidth={1.7} /></button>;
}

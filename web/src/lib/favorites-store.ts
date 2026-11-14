"use client";

import { useSyncExternalStore } from "react";

const key = "naa:favorites:v1";
const empty: readonly string[] = [];
let current: readonly string[] = empty;
let initialized = false;
const listeners = new Set<() => void>();

function publish(ids: readonly string[]) {
  current = ids;
  listeners.forEach((listener) => listener());
}

function read(): readonly string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    publish(read());
    window.addEventListener("storage", (event) => {
      if (event.key === key || event.key === null) publish(read());
    });
  }
  return () => { listeners.delete(listener); };
}

export function useFavorites() {
  return useSyncExternalStore(subscribe, () => current, () => empty);
}

export function toggleFavorite(id: string) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the current tab responsive if storage is unavailable. */ }
  publish(next);
}

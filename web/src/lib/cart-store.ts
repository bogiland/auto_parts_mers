"use client";

import { useSyncExternalStore } from "react";
import type { Product } from "@/domain/catalog";

export type CartItem = { id: string; quantity: number };
type CartSnapshot = { loaded: boolean; items: CartItem[]; error: boolean };
const key = "naa:cart:v1";
const empty: CartSnapshot = { loaded: false, items: [], error: false };
let current: CartSnapshot = empty;
let initialized = false;
const listeners = new Set<() => void>();

function publish(snapshot: CartSnapshot) {
  current = snapshot;
  listeners.forEach((listener) => listener());
}

function read(): CartSnapshot {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) throw new Error("Invalid cart");
    const items = stored.filter((item): item is CartItem =>
      typeof item === "object" && item !== null && typeof item.id === "string" &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0,
    );
    return { loaded: true, items, error: false };
  } catch {
    return { loaded: true, items: [], error: true };
  }
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  publish(read());
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) publish(read());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  initialize();
  return () => { listeners.delete(listener); };
}

export function useCart() {
  return useSyncExternalStore(subscribe, () => current, () => empty);
}

function save(items: CartItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    publish({ loaded: true, items, error: false });
  } catch {
    publish({ ...current, error: true });
  }
}

export function retryCart() { publish(read()); }
export function clearCart() { save([]); }
export function removeCartItem(id: string) { save(current.items.filter((item) => item.id !== id)); }
export function restoreCartItem(item: CartItem) { save([...read().items.filter((existing) => existing.id !== item.id), item]); }

export function setCartQuantity(product: Product, quantity: number) {
  if (product.priceMode !== "fixed" || product.priceMdl === null || product.stock === 0) return;
  const max = product.stock ?? 1;
  const next = Math.min(Math.max(0, quantity), max);
  const items = read().items.filter((item) => item.id !== product.id);
  if (next > 0) items.push({ id: product.id, quantity: next });
  save(items);
}

export function cartQuantity(snapshot: CartSnapshot, id: string) {
  return snapshot.items.find((item) => item.id === id)?.quantity ?? 0;
}

export function cartCount(snapshot: CartSnapshot) {
  return snapshot.items.reduce((total, item) => total + item.quantity, 0);
}

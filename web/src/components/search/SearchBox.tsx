"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { normalizeQuery } from "@/lib/search/query";
import type { SearchSuggestionResponse } from "@/lib/search/types";

type SearchBoxProps = {
  mobile?: boolean;
};

type SuggestionItem = {
  description?: string;
  href: string;
  id: string;
  image?: string;
  label: string;
  price?: string;
};

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ query, value }: { query: string; value: string }) {
  const tokens = normalizeQuery(query).split(" ").filter((token) => token.length > 1).map(escapeExpression);
  if (!tokens.length) return value;

  const expression = new RegExp(`(${tokens.join("|")})`, "gi");
  const exactExpression = new RegExp(`^(${tokens.join("|")})$`, "i");
  return value.split(expression).map((part, index) => exactExpression.test(part) ? <mark className="bg-transparent font-bold text-accent" key={`${part}-${index}`}>{part}</mark> : part);
}

export function resolveSearchRedirect(query: string, suggestions: SearchSuggestionResponse | null) {
  return suggestions?.redirect ?? `/search?q=${encodeURIComponent(query)}&from_global=true`;
}

export function SearchBoxFallback({ mobile = false }: SearchBoxProps) {
  return <div aria-hidden="true" className={`${mobile ? "header-mobile-search" : "h-control"} min-w-0 flex-1 rounded-ui bg-white`} />;
}

export function SearchBox({ mobile = false }: SearchBoxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = useId();
  const inputId = mobile ? "mobile-catalog-search" : "catalog-search";
  const placeholder = mobile ? "Поиск по коду или названию" : "Поиск по коду детали, модели или категории";
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestionResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const cacheRef = useRef(new Map<string, SearchSuggestionResponse>());

  const items = useMemo<SuggestionItem[]>(() => {
    if (!suggestions) return [];
    const categoryParams = new URLSearchParams({ from_global: "true", q: query }).toString();
    return [
      ...suggestions.products.map((product) => ({
        description: `${product.brand} · ${product.sku}`,
        href: `/products/${product.slug}`,
        id: `product-${product.id}`,
        image: product.thumb.url,
        label: product.name,
        price: product.price ? `${product.price.toLocaleString("ru-RU")} L.` : "Уточнить цену",
      })),
      ...suggestions.categories.map((category) => ({ description: category.path, href: `/catalog/legkovye/${category.slug}?${categoryParams}`, id: `category-${category.slug}`, label: category.name })),
      ...suggestions.brands.map((brand) => ({ href: `/search?q=${encodeURIComponent(query)}&brand=${encodeURIComponent(brand.slug)}&from_global=true`, id: `brand-${brand.slug}`, label: brand.name })),
    ];
  }, [query, suggestions]);

  useEffect(() => {
    const normalized = normalizeQuery(query);
    if (normalized.length < 2 || cacheRef.current.has(normalized)) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as SearchSuggestionResponse;
        if (!controller.signal.aborted) {
          cacheRef.current.set(normalized, data);
          setSuggestions(data);
          setActiveIndex(-1);
        }
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") setSuggestions(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
    setIsLoading(false);
  }

  function navigate(href: string) {
    router.push(href);
    close();
  }

  function changeQuery(value: string) {
    const normalized = normalizeQuery(value);
    const cached = cacheRef.current.get(normalized) ?? null;
    setQuery(value);
    setSuggestions(cached);
    setIsOpen(normalized.length >= 2);
    setIsLoading(normalized.length >= 2 && !cached);
    setActiveIndex(-1);
  }

  function selectCurrentOrSearch() {
    if (activeIndex >= 0 && items[activeIndex]) {
      navigate(items[activeIndex].href);
      return;
    }

    if (normalizeQuery(query)) navigate(resolveSearchRedirect(query, suggestions));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectCurrentOrSearch();
      return;
    }

    if (!items.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    setIsOpen(true);
    setActiveIndex((current) => event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length);
  }

  const isEmpty = Boolean(suggestions && !items.length);

  return (
    <div className={`relative z-40 flex min-w-0 flex-1 ${isOpen ? "z-50" : ""}`}>
      {isOpen ? <button aria-label="Закрыть подсказки поиска" className="fixed inset-0 z-30 bg-ink/40" onClick={close} type="button" /> : null}
      <form className="relative z-40 flex min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); selectCurrentOrSearch(); }} role="search">
        <label className="sr-only" htmlFor={inputId}>Поиск по каталогу</label>
        <input
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${items[activeIndex]?.id}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          className={`${mobile ? "header-mobile-search" : "h-control"} min-w-0 flex-1 rounded-l-ui border-2 border-r-0 border-accent bg-white pl-3.5 pr-11 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent`}
          id={inputId}
          onChange={(event) => changeQuery(event.target.value)}
          onFocus={() => { if (normalizeQuery(query).length >= 2) setIsOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="search"
          value={query}
        />
        <button aria-label="Искать" className={`${mobile ? "header-mobile-search w-11" : "h-control w-12"} rounded-r-ui bg-accent text-white hover:bg-accent-hover`} type="submit"><Search aria-hidden="true" className="mx-auto" size={20} strokeWidth={1.8} /></button>
        {isOpen ? (
          <section aria-label="Подсказки поиска" className="search-suggestions absolute left-0 right-0 top-full z-50 mt-2 overflow-y-auto rounded-ui bg-white shadow-card" id={listId} role="listbox">
            {isLoading && !suggestions ? <div className="p-3" aria-label="Загрузка"><div className="h-10 animate-pulse rounded-ui bg-surface-2" /><div className="mt-2 h-10 animate-pulse rounded-ui bg-surface-2" /><div className="mt-2 h-10 animate-pulse rounded-ui bg-surface-2" /></div> : null}
            {!isLoading && suggestions?.products.length ? <div className="border-b border-line py-2"><p className="px-3 py-2 text-meta font-bold text-ink-2">Товары</p>{suggestions.products.map((product) => {
              const index = items.findIndex((item) => item.id === `product-${product.id}`);
              return <Link aria-selected={activeIndex === index} className={`flex min-w-0 items-center gap-3 px-3 py-2 ${activeIndex === index ? "bg-surface-2" : "hover:bg-surface-2"}`} href={`/products/${product.slug}`} id={`${listId}-product-${product.id}`} key={product.id} onClick={close} role="option"><div className="relative h-10 w-10 shrink-0"><Image alt="" className="object-contain" fill sizes="40px" src={product.thumb.url} /></div><div className="min-w-0 flex-1"><p className="truncate text-body text-ink"><Highlight query={query} value={product.name} /></p><p className="truncate text-meta text-ink-2">{product.brand} · {product.sku}</p></div><span className="shrink-0 text-meta font-bold text-accent">{product.price ? `${product.price.toLocaleString("ru-RU")} L.` : "Уточнить цену"}</span></Link>;
            })}</div> : null}
            {!isLoading && suggestions?.categories.length ? <div className="border-b border-line py-2"><p className="px-3 py-2 text-meta font-bold text-ink-2">Категории</p>{suggestions.categories.map((category) => {
              const index = items.findIndex((item) => item.id === `category-${category.slug}`);
              const categoryParams = new URLSearchParams({ from_global: "true", q: query }).toString();
              return <Link aria-selected={activeIndex === index} className={`block px-3 py-2 ${activeIndex === index ? "bg-surface-2" : "hover:bg-surface-2"}`} href={`/catalog/legkovye/${category.slug}?${categoryParams}`} id={`${listId}-category-${category.slug}`} key={category.slug} onClick={close} role="option"><p className="text-body text-ink"><Highlight query={query} value={category.name} /></p><p className="truncate text-meta text-ink-2">{category.path}</p></Link>;
            })}</div> : null}
            {!isLoading && suggestions?.brands.length ? <div className="py-2"><p className="px-3 py-2 text-meta font-bold text-ink-2">Бренды</p>{suggestions.brands.map((brand) => {
              const index = items.findIndex((item) => item.id === `brand-${brand.slug}`);
              return <Link aria-selected={activeIndex === index} className={`block px-3 py-2 text-body text-ink ${activeIndex === index ? "bg-surface-2" : "hover:bg-surface-2"}`} href={`/search?q=${encodeURIComponent(query)}&brand=${encodeURIComponent(brand.slug)}&from_global=true`} id={`${listId}-brand-${brand.slug}`} key={brand.slug} onClick={close} role="option"><Highlight query={query} value={brand.name} /></Link>;
            })}</div> : null}
            {isEmpty ? <div className="p-4"><p className="text-body text-ink">Ничего не нашли — эксперт подберёт бесплатно</p><Link className="mt-3 inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href="/#expert-request" onClick={close}>Оставить заявку</Link></div> : null}
          </section>
        ) : null}
      </form>
    </div>
  );
}

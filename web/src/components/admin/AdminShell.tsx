"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import type { Role } from "@/lib/staff-db";
import { sections, type Section } from "./admin-sections";


type Result = { group: string; label: string; href: string; meta?: string };
export function AdminShell({ section, role, name, counts, children }: { section: Section; role: Role; name: string; counts: Record<string, number>; children: ReactNode }) {
  const [theme, setTheme] = useState("dark");
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => { const frame = requestAnimationFrame(() => { setTheme(localStorage.getItem("naa-admin-theme") === "light" ? "light" : "dark"); setReady(true); }); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" || event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); setSearch(true); setTimeout(() => searchRef.current?.focus(), 0); }
      if (event.key === "Escape") { setSearch(false); setDrawer(false); setQuick(false); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { setSearching(true); fetch(`/api/staff/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : { results: [] }).then((data) => setResults(data.results ?? [])).catch(() => {}).finally(() => setSearching(false)); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const nav = Object.entries(sections).filter(([, item]) => !("owner" in item && item.owner && role !== "owner"));
  const groups = [...new Set(nav.map(([, item]) => item.group))];
  const itemLink = (id: Section, compact = false) => { const item = sections[id]; const Icon = item.icon; return <Link aria-current={section === id ? "page" : undefined} className={`admin-nav-item ${section === id ? "is-active" : ""} ${compact ? "is-compact" : ""}`} href={`/admin/${id}`} onClick={() => setDrawer(false)} key={id}><Icon size={18} /><span>{item.label}</span>{!compact && counts[id] ? <small>{counts[id]}</small> : null}</Link>; };
  async function logout() { await fetch("/api/staff/logout", { method: "POST" }); localStorage.setItem("naa:staff-logout", String(Date.now())); router.replace("/admin/login"); router.refresh(); }
  const title = sections[section]; const HeadingIcon = title.icon;
  // data-ready появляется после гидратации: по нему видно, что кнопки и меню уже живые.
  return <div className="admin-shell" data-ready={ready ? "1" : undefined} data-theme={theme}>
    {drawer && <button aria-label="Закрыть меню" className="admin-scrim" onClick={() => setDrawer(false)} />}
    <aside className={`admin-sidebar ${drawer ? "is-open" : ""}`}><Link className="admin-brand" href="/admin/dashboard"><span>NAA<span>.md</span></span><small>CRM</small></Link><nav aria-label="Админка">{groups.map((group) => <div className="admin-nav-group" key={group}><p>{group}</p>{nav.filter(([, item]) => item.group === group).map(([id]) => itemLink(id as Section))}</div>)}</nav><div className="admin-profile"><div className="admin-avatar">{name.slice(0, 1).toUpperCase()}</div><div><strong>{name}</strong><small>{role === "owner" ? "Владелец" : "Оператор"}</small></div><button aria-label="Выйти" onClick={logout} type="button"><LogOut size={18} /></button></div></aside>
      <div className="admin-body"><header className="admin-topbar"><button aria-label="Открыть меню" className="admin-menu-button" onClick={() => setDrawer(true)}><Menu /></button><button className="admin-search-trigger" onClick={() => { setSearch(true); setTimeout(() => searchRef.current?.focus(), 0); }}><Search size={17} /><span>Заказ, телефон, SKU, артикул...</span><kbd>Ctrl K</kbd></button><div className="admin-top-actions"><button aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"} onClick={() => { const next = localStorage.getItem("naa-admin-theme") === "light" ? "dark" : "light"; setTheme(next); localStorage.setItem("naa-admin-theme", next); }}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button><button aria-label="Новые заказы и обращения" onClick={() => router.push("/admin/orders")}><Bell size={19} />{counts.new ? <b>{counts.new}</b> : null}</button></div></header>
      <main className="admin-main"><div className="admin-heading"><div className="admin-heading-icon"><HeadingIcon size={23} /></div><div><h1>{title.label}</h1><p>{title.subtitle}</p></div><div className="admin-heading-spacer" /><span className="admin-period">Всё время</span>{section === "orders" ? <Link className="admin-button" href="/admin/orders?new=1">+ Заказ</Link> : section === "requests" ? <Link className="admin-button" href="/admin/requests?new=1">+ Обращение</Link> : section === "inventory" ? <Link className="admin-button" href="/admin/inventory?add=1">+ Деталь</Link> : null}</div>{children}</main>
    </div>
    <nav className="admin-mobile-nav" aria-label="Быстрое меню">{itemLink("dashboard", true)}{itemLink("orders", true)}{itemLink("requests", true)}<button className="admin-quick-button" aria-label="Добавить" onClick={() => setQuick(!quick)}><Plus size={24} /></button>{itemLink("inventory", true)}<button className="admin-nav-item is-compact" onClick={() => setDrawer(true)}><Menu size={18} /><span>Ещё</span></button></nav>
    {quick && <div className="admin-quick-menu"><Link href="/admin/orders?new=1">+ Заказ</Link><Link href="/admin/requests?new=1">+ Звонок</Link><Link href="/admin/inventory?add=1">+ Деталь</Link></div>}
    {search && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearch(false); }}><div className="admin-search-dialog" role="dialog" aria-label="Поиск"><div className="admin-search-field"><Search size={20} /><input autoComplete="off" autoFocus ref={searchRef} onChange={(event) => setQuery(event.target.value)} placeholder="Номер заказа, телефон, SKU, артикул" value={query} /><button aria-label="Закрыть" onClick={() => setSearch(false)}><X size={19} /></button></div><div className="admin-search-results">{searching ? "Ищем…" : results.length ? results.map((result, index) => <Link href={result.href} key={`${result.href}-${index}`} onClick={() => setSearch(false)}><small>{result.group}</small><strong>{result.label}</strong><span>{result.meta}</span></Link>) : query ? "Ничего не найдено" : "Начните вводить запрос"}</div></div></div>}
  </div>;
}

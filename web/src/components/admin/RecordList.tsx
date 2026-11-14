"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

type Row = { key: string; title: string; meta: string; search: string; status?: string; content: ReactNode };
const statusLabel: Record<string, string> = { received: "Получен", confirmed: "Подтверждён", ready: "Готов / отправлен", issued: "Выдан", new: "Новая", in_progress: "В работе", closed: "Закрыта" };
export function RecordList({ rows, empty }: { rows: Row[]; empty: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [active, setActive] = useState<Row | null>(null);
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const sort = params.get("sort") ?? "new";
  const filtered = rows.filter((row) => row.search.toLowerCase().includes(query.toLowerCase()) && (status === "all" || row.status === status));
  if (sort === "old") filtered.reverse();
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  function update(key: string, value: string) { const next = new URLSearchParams(params.toString()); if (value && value !== "all" && !(key === "page" && value === "1") && !(key === "sort" && value === "new")) next.set(key, value); else next.delete(key); if (key !== "page") next.delete("page"); router.replace(`?${next.toString()}`, { scroll: false }); }
  return <><div className="admin-table-tools"><input aria-label="Поиск в списке" onChange={(event) => update("q", event.target.value)} placeholder="Поиск в списке" value={query} /><select aria-label="Фильтр статуса" onChange={(event) => update("status", event.target.value)} value={status}><option value="all">Все статусы</option>{[...new Set(rows.map((row) => row.status).filter(Boolean))].map((value) => <option key={value} value={value}>{statusLabel[value!] ?? value}</option>)}</select><select aria-label="Сортировка" onChange={(event) => update("sort", event.target.value)} value={sort}><option value="new">Сначала новые</option><option value="old">Сначала старые</option></select></div><div className="admin-list">{filtered.slice((Math.min(page, pages) - 1) * 15, Math.min(page, pages) * 15).map((row) => <button className="admin-card admin-record admin-row" key={row.key} onClick={() => setActive(row)} type="button"><div style={{ textAlign: "left" }}><strong>{row.title}</strong><p className="admin-muted">{row.meta}</p></div>{row.status && <span className="admin-chip" data-status={row.status}>{statusLabel[row.status] ?? row.status}</span>}</button>)}{!filtered.length && <div className="admin-card admin-muted">{query || status !== "all" ? "Ничего не найдено" : empty}</div>}</div>{pages > 1 && <div className="admin-table-tools" style={{ marginTop: 16 }}><button disabled={page <= 1} onClick={() => update("page", String(page - 1))}>← Назад</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => update("page", String(page + 1))}>Вперёд →</button></div>}{active && <div className="admin-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null); }}><section className="admin-detail" role="dialog" aria-label={active.title}><header><h2>{active.title}</h2><button aria-label="Закрыть карточку" onClick={() => setActive(null)}><X size={22} /></button></header><p>{active.meta}</p>{active.status && <span className="admin-chip" data-status={active.status}>{statusLabel[active.status] ?? active.status}</span>}<div className="admin-list" style={{ marginTop: 20 }}>{active.content}</div></section></div>}</>;
}

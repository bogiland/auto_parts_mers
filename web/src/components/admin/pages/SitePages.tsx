"use client";
// Страницы сайта правятся здесь: заголовок и текст на двух языках, фото, где показывать, порядок, включить или выключить.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Pencil, Plus, Trash, X } from "lucide-react";
import { SingleImageField } from "@/components/admin/ImagePicker";
import type { SitePage } from "@/lib/pages-db";

type Draft = Omit<Partial<SitePage>, "id"> & { id?: string | null; slug: string; titleRu: string };

async function call(body: Record<string, unknown>) {
  const response = await fetch("/api/staff/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Не удалось сохранить. Попробуйте снова.");
  return (await response.json().catch(() => ({}))) as { id?: string };
}

const empty: Draft = { id: null, slug: "", titleRu: "", titleRo: "", bodyRu: "", bodyRo: "", image: "", seoTitle: "", seoDescription: "", placement: "none", inHeader: false, showContacts: false, visible: true };

export function SitePages({ pages, placements }: { pages: SitePage[]; placements: { id: string; label: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const label = (id: string) => placements.find((item) => item.id === id)?.label ?? id;

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await call(body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-row">
      <div>
        <h2>Страницы сайта</h2>
        <p className="admin-muted">Выключенная страница отдаёт 404 и исчезает из шапки, подвала и карты сайта. Ссылка на неё больше никуда не ведёт — поэтому выключайте только то, что действительно не нужно.</p>
      </div>
      <button className="admin-button" onClick={() => { setDraft({ ...empty }); setError(""); }} type="button"><Plus size={16} />Страница</button>
    </div>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !draft && <p className="admin-error" role="alert">{error}</p>}

    <div className="admin-list">
      {pages.map((page, index) => <div className="admin-card admin-row admin-sub-card" key={page.id}>
        <div className="admin-tree-actions">
          <button aria-label="Выше" className="admin-icon-button" disabled={busy || index === 0} onClick={() => void run({ action: "move-page", id: page.id, direction: "up" }, "Порядок изменён")} type="button"><ChevronUp size={16} /></button>
          <button aria-label="Ниже" className="admin-icon-button" disabled={busy || index === pages.length - 1} onClick={() => void run({ action: "move-page", id: page.id, direction: "down" }, "Порядок изменён")} type="button"><ChevronDown size={16} /></button>
        </div>
        <div className="admin-tree-name">
          <strong>{page.titleRu}</strong>
          <small className="admin-muted">/{page.slug} · {label(page.placement)}{page.inHeader ? " · строка над меню" : ""}{page.showContacts ? " · с контактами" : ""}{page.titleRo ? "" : " · нет RO"}</small>
        </div>
        {!page.visible && <span className="admin-chip" data-status="closed">выключена</span>}
        <div className="admin-tree-actions">
          {page.visible && <Link aria-label="Открыть на сайте" className="admin-icon-button" href={`/${page.slug}`} target="_blank"><ExternalLink size={16} /></Link>}
          <button aria-label={page.visible ? "Выключить" : "Включить"} className="admin-icon-button" disabled={busy} onClick={() => void run({ action: "page-visible", id: page.id, visible: !page.visible }, page.visible ? "Страница выключена" : "Страница включена")} type="button">{page.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setDraft({ ...page }); setError(""); }} type="button"><Pencil size={16} /></button>
          <button aria-label="Удалить" className="admin-icon-button" disabled={busy} onClick={() => { if (window.confirm(`Удалить страницу «${page.titleRu}»? Ссылки на неё перестанут работать.`)) void run({ action: "delete-page", id: page.id }, "Страница удалена"); }} type="button"><Trash size={16} /></button>
        </div>
      </div>)}
      {!pages.length && <p className="admin-muted">Страниц пока нет.</p>}
    </div>

    {draft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section aria-label="Страница сайта" className="admin-detail" role="dialog">
        <header><h2>{draft.id ? draft.titleRu : "Новая страница"}</h2><button aria-label="Закрыть" onClick={() => setDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Заголовок, русский<input onChange={(event) => setDraft({ ...draft, titleRu: event.target.value })} value={draft.titleRu} /></label>
          <label className="admin-field">Заголовок, румынский<input onChange={(event) => setDraft({ ...draft, titleRo: event.target.value })} value={draft.titleRo ?? ""} /></label>
          {draft.id
            ? <p className="admin-note admin-field-wide">Адрес страницы: <strong>/{draft.slug}</strong>. У существующей страницы он не меняется — иначе сохранённые и разосланные ссылки перестали бы работать.</p>
            : <label className="admin-field">Адрес страницы<input onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="delivery" value={draft.slug} /></label>}
          <label className="admin-field admin-field-wide">Текст, русский<textarea onChange={(event) => setDraft({ ...draft, bodyRu: event.target.value })} rows={12} value={draft.bodyRu ?? ""} /></label>
          <label className="admin-field admin-field-wide">Текст, румынский<textarea onChange={(event) => setDraft({ ...draft, bodyRo: event.target.value })} rows={8} value={draft.bodyRo ?? ""} /></label>
          <p className="admin-note admin-field-wide">Разметка простая: строка, начинающаяся с «## », становится подзаголовком, строка с «- » — пунктом списка, пустая строка — новым абзацем. Строка вида «_текст_» превращается в сноску мелким шрифтом — так оформлена пометка о юристе.</p>
          <label className="admin-field">Где показывать ссылку<select onChange={(event) => setDraft({ ...draft, placement: event.target.value as SitePage["placement"] })} value={draft.placement ?? "none"}>{placements.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="admin-field admin-field-check"><input checked={draft.inHeader ?? false} onChange={(event) => setDraft({ ...draft, inHeader: event.target.checked })} type="checkbox" />Показывать в строке над меню</label>
          <label className="admin-field admin-field-check"><input checked={draft.showContacts ?? false} onChange={(event) => setDraft({ ...draft, showContacts: event.target.checked })} type="checkbox" />Показывать на странице блок контактов и карту</label>
          <label className="admin-field admin-field-check"><input checked={draft.visible ?? true} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} type="checkbox" />Страница включена</label>
          <label className="admin-field">Заголовок для поиска<input onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} value={draft.seoTitle ?? ""} /></label>
          <label className="admin-field admin-field-wide">Описание для поиска<textarea onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} rows={2} value={draft.seoDescription ?? ""} /></label>
        </div>
        <SingleImageField help="Фото показывается над текстом страницы." label="Картинка страницы" onChange={(next) => setDraft({ ...draft, image: next })} preset="article" value={draft.image ?? ""} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions">
          <button className="admin-button" disabled={busy} onClick={async () => { if (await run({ action: "save-page", ...draft }, "Страница сохранена")) setDraft(null); }} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button>
          <button className="admin-ghost-button" onClick={() => setDraft(null)} type="button">Отмена</button>
        </div>
      </section>
    </div>}
  </section>;
}

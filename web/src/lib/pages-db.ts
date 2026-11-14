import "server-only";

import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getCheckoutCatalog } from "@/lib/checkout-db";
import { audit, type Staff } from "@/lib/staff-db";
import { saveImage } from "@/lib/reference-db";
import { sitePagesSeed, type PagePlacement } from "@/data/site-pages.seed";

type Row = Record<string, string | number | null>;
type Statement = { get(...args: (string | number | null)[]): Row | undefined; all(...args: (string | number | null)[]): Row[]; run(...args: (string | number | null)[]): { changes: number } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };

const require = createRequire(import.meta.url);
let connection: Database | undefined;

function db(): Database {
  if (connection) return connection;
  getCheckoutCatalog();
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (file: string) => Database };
  const database = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS site_pages (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
      title_ru TEXT NOT NULL, title_ro TEXT NOT NULL DEFAULT '',
      body_ru TEXT NOT NULL DEFAULT '', body_ro TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '', seo_title TEXT NOT NULL DEFAULT '', seo_description TEXT NOT NULL DEFAULT '',
      visible INTEGER NOT NULL DEFAULT 1, show_contacts INTEGER NOT NULL DEFAULT 0,
      placement TEXT NOT NULL DEFAULT 'none', in_header INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
      seeded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`);
  if (!database.prepare("PRAGMA table_info(site_pages)").all().some((column) => column.name === "in_header")) database.exec("ALTER TABLE site_pages ADD COLUMN in_header INTEGER NOT NULL DEFAULT 0");
  const insert = database.prepare(`INSERT OR IGNORE INTO site_pages
    (id,slug,title_ru,title_ro,body_ru,body_ro,image,seo_title,seo_description,visible,show_contacts,placement,in_header,sort_order,seeded,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,1,?)`);
  const now = new Date().toISOString();
  sitePagesSeed.forEach((page, index) => {
    insert.run(`page-${page.slug}`, page.slug, page.titleRu, page.titleRo, page.bodyRu, page.bodyRo, page.image, page.seoTitle, page.seoDescription, page.showContacts ? 1 : 0, page.placement, page.inHeader ? 1 : 0, index * 10, now);
  });
  connection = database;
  return database;
}

export type SitePage = {
  id: string; slug: string; titleRu: string; titleRo: string; bodyRu: string; bodyRo: string;
  image: string; seoTitle: string; seoDescription: string; visible: boolean; showContacts: boolean;
  placement: PagePlacement; inHeader: boolean; sortOrder: number; seeded: boolean;
};

export const placements: { id: PagePlacement; label: string }[] = [
  { id: "nav", label: "Верхнее меню сайта" },
  { id: "footer-company", label: "Подвал: О компании" },
  { id: "footer-buyer", label: "Подвал: Покупателям" },
  { id: "none", label: "Нигде не показывать" },
];

function toPage(row: Row): SitePage {
  return {
    id: String(row.id), slug: String(row.slug), titleRu: String(row.title_ru), titleRo: String(row.title_ro),
    bodyRu: String(row.body_ru), bodyRo: String(row.body_ro), image: String(row.image),
    seoTitle: String(row.seo_title), seoDescription: String(row.seo_description),
    visible: Number(row.visible) === 1, showContacts: Number(row.show_contacts) === 1,
    placement: String(row.placement) as PagePlacement, inHeader: Number(row.in_header) === 1,
    sortOrder: Number(row.sort_order), seeded: Number(row.seeded) === 1,
  };
}

/** Все страницы для админки, включая выключенные. */
export function allPages(): SitePage[] {
  return db().prepare("SELECT * FROM site_pages ORDER BY sort_order, title_ru").all().map(toPage);
}

/** Только включённые: из них собираются меню, подвал и карта сайта. */
export function visiblePages(): SitePage[] {
  return db().prepare("SELECT * FROM site_pages WHERE visible=1 ORDER BY sort_order, title_ru").all().map(toPage);
}

/** Ссылки для одного места в оформлении сайта. */
export function pageLinks(placement: PagePlacement) {
  return visiblePages().filter((page) => page.placement === placement).map((page) => ({ label: page.titleRu, href: `/${page.slug}` }));
}

/** Информационная строка над меню на широком экране. */
export function headerLinks() {
  return visiblePages().filter((page) => page.inHeader).map((page) => ({ label: page.titleRu, href: `/${page.slug}` }));
}

/** Выключенная страница недоступна: открывший её получит 404, как просит задача. */
export function findPage(slug: string): SitePage | null {
  const row = db().prepare("SELECT * FROM site_pages WHERE slug=? AND visible=1").get(slug);
  return row ? toPage(row) : null;
}

const text = (value: unknown, limit: number) => (typeof value === "string" ? value.split("\r\n").join("\n").trim().slice(0, limit) : "");

export function savePage(actor: Staff, input: Record<string, unknown>) {
  const id = typeof input.id === "string" && input.id ? input.id : null;
  const titleRu = text(input.titleRu, 120);
  if (titleRu.length < 2) throw new Error("Напишите заголовок страницы по-русски.");
  const bodyRu = text(input.bodyRu, 20_000);
  const bodyRo = text(input.bodyRo, 20_000);
  const placement = placements.some((item) => item.id === input.placement) ? String(input.placement) : "none";
  const image = saveImage(typeof input.image === "string" ? input.image : "");
  const inHeader = input.inHeader === true || input.inHeader === "on" ? 1 : 0;
  const showContacts = input.showContacts === true || input.showContacts === "on" ? 1 : 0;
  const visible = input.visible === false || input.visible === "off" ? 0 : 1;
  if (id) {
    const result = db().prepare("UPDATE site_pages SET title_ru=?,title_ro=?,body_ru=?,body_ro=?,image=?,seo_title=?,seo_description=?,show_contacts=?,placement=?,in_header=?,visible=? WHERE id=?")
      .run(titleRu, text(input.titleRo, 120), bodyRu, bodyRo, image, text(input.seoTitle, 180), text(input.seoDescription, 400), showContacts, placement, inHeader, visible, id);
    if (!result.changes) throw new Error("Страница не найдена.");
    audit(actor, "Правка страницы сайта", `${id}: ${titleRu}`);
    return id;
  }
  const slug = text(input.slug, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length < 2) throw new Error("Укажите адрес страницы латинскими буквами, например delivery.");
  if (db().prepare("SELECT id FROM site_pages WHERE slug=?").get(slug)) throw new Error("Страница с таким адресом уже есть.");
  const next = `page-${randomBytes(6).toString("hex")}`;
  const last = Number(db().prepare("SELECT COALESCE(MAX(sort_order),0) AS value FROM site_pages").get()?.value ?? 0);
  db().prepare(`INSERT INTO site_pages(id,slug,title_ru,title_ro,body_ru,body_ro,image,seo_title,seo_description,visible,show_contacts,placement,in_header,sort_order,seeded,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`)
    .run(next, slug, titleRu, text(input.titleRo, 120), bodyRu, bodyRo, image, text(input.seoTitle, 180), text(input.seoDescription, 400), visible, showContacts, placement, inHeader, last + 10, new Date().toISOString());
  audit(actor, "Новая страница сайта", `/${slug}: ${titleRu}`);
  return next;
}

export function setPageVisible(actor: Staff, id: string, visible: boolean) {
  const result = db().prepare("UPDATE site_pages SET visible=? WHERE id=?").run(visible ? 1 : 0, id);
  if (!result.changes) throw new Error("Страница не найдена.");
  audit(actor, visible ? "Страница включена" : "Страница выключена", id);
}

export function movePage(actor: Staff, id: string, direction: "up" | "down") {
  const pages = allPages();
  const index = pages.findIndex((page) => page.id === id);
  if (index < 0) throw new Error("Страница не найдена.");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= pages.length) return;
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const update = database.prepare("UPDATE site_pages SET sort_order=? WHERE id=?");
    pages.forEach((page, position) => {
      const order = position === index ? target : position === target ? index : position;
      update.run(order * 10, page.id);
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  audit(actor, "Порядок страниц", `${id}: ${direction === "up" ? "выше" : "ниже"}`);
}

export function deletePage(actor: Staff, id: string) {
  const row = db().prepare("SELECT slug,seeded,title_ru FROM site_pages WHERE id=?").get(id);
  if (!row) throw new Error("Страница не найдена.");
  if (Number(row.seeded) === 1) throw new Error("Эту страницу можно только выключить: на неё ссылаются шапка и подвал, и удаление вернуло бы ошибку 404.");
  db().prepare("DELETE FROM site_pages WHERE id=?").run(id);
  audit(actor, "Удаление страницы сайта", `/${row.slug}: ${row.title_ru}`);
}

type Block = { kind: "heading" | "paragraph" | "note"; text: string } | { kind: "list"; items: string[] };

/** Разбор простой разметки: «## » — подзаголовок, «- » — пункт списка, пустая строка — новый абзац, «_текст_» — сноска. */
export function pageBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    let list: string[] = [];
    let paragraph: string[] = [];
    const flushList = () => { if (list.length) blocks.push({ kind: "list", items: list }); list = []; };
    const flushParagraph = () => {
      if (paragraph.length) {
        const text = paragraph.join(" ");
        const note = /^_(.+)_$/.exec(text);
        blocks.push(note ? { kind: "note", text: note[1] } : { kind: "paragraph", text });
      }
      paragraph = [];
    };
    for (const line of lines) {
      if (line.startsWith("## ")) { flushList(); flushParagraph(); blocks.push({ kind: "heading", text: line.slice(3).trim() }); }
      else if (line.startsWith("- ")) { flushParagraph(); list.push(line.slice(2).trim()); }
      else { flushList(); paragraph.push(line); }
    }
    flushList();
    flushParagraph();
  }
  return blocks;
}

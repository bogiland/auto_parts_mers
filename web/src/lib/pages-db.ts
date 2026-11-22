import { legacyQuery, transaction } from "@/lib/db";
import "server-only";

import { randomBytes } from "node:crypto";
import { audit, type Staff } from "@/lib/staff-db";
import { saveImage } from "@/lib/reference-db";
import { sitePagesSeed, type PagePlacement } from "@/data/site-pages.seed";

type Row = Record<string, string | number | null>;

let seeded:Promise<void>|undefined;
async function ensurePages(){
 if(!seeded)seeded=(async()=>{for(const [index,page] of sitePagesSeed.entries())await legacyQuery.run<Row>(`INSERT INTO site_pages(id,slug,title_ru,title_ro,body_ru,body_ro,image,seo_title,seo_description,visible,show_contacts,placement,in_header,sort_order,seeded,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,1,?) ON CONFLICT DO NOTHING`,[`page-${page.slug}`,page.slug,page.titleRu,page.titleRo,page.bodyRu,page.bodyRo,page.image,page.seoTitle,page.seoDescription,page.showContacts?1:0,page.placement,page.inHeader?1:0,index*10,new Date().toISOString()]);})();
 try{await seeded;}catch(e){seeded=undefined;throw e;}
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
export async function allPages(): Promise<SitePage[]> {
  await ensurePages();
  return (await legacyQuery.all<Row>("SELECT * FROM site_pages ORDER BY sort_order, title_ru", [])).map(toPage);
}

/** Только включённые: из них собираются меню, подвал и карта сайта. */
export async function visiblePages(): Promise<SitePage[]> {
  await ensurePages();
  return (await legacyQuery.all<Row>("SELECT * FROM site_pages WHERE visible=1 ORDER BY sort_order, title_ru", [])).map(toPage);
}

/** Ссылки для одного места в оформлении сайта. */
export async function pageLinks(placement: PagePlacement) {
  const news=await legacyQuery.get<Row>("SELECT id FROM news_articles WHERE published AND published_at<=now() LIMIT 1",[]);
  const reviews=await legacyQuery.get<Row>("SELECT id FROM product_reviews WHERE product_id='' AND status='published' LIMIT 1",[]);
  return (await visiblePages()).filter((page) => page.placement === placement && (page.slug!=='media'||!!news) && (page.slug!=='reviews'||!!reviews)).map((page) => ({ label: page.titleRu, href: page.slug==='media'?'/news':`/${page.slug}` }));
}

/** Информационная строка над меню на широком экране. */
export async function headerLinks() {
  return (await visiblePages()).filter((page) => page.inHeader).map((page) => ({ label: page.titleRu, href: `/${page.slug}` }));
}

/** Выключенная страница недоступна: открывший её получит 404, как просит задача. */
export async function findPage(slug: string): Promise<SitePage | null> {
  await ensurePages();
  const row = (await legacyQuery.get<Row>("SELECT * FROM site_pages WHERE slug=? AND visible=1", [slug]));
  return row ? toPage(row) : null;
}

const text = (value: unknown, limit: number) => (typeof value === "string" ? value.split("\r\n").join("\n").trim().slice(0, limit) : "");

export async function savePage(actor: Staff, input: Record<string, unknown>) {
return (await transaction(async () => {
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
    const result = (await legacyQuery.run<Row>("UPDATE site_pages SET title_ru=?,title_ro=?,body_ru=?,body_ro=?,image=?,seo_title=?,seo_description=?,show_contacts=?,placement=?,in_header=?,visible=? WHERE id=?", [titleRu, text(input.titleRo, 120), bodyRu, bodyRo, image, text(input.seoTitle, 180), text(input.seoDescription, 400), showContacts, placement, inHeader, visible, id]));
    if (!result.changes) throw new Error("Страница не найдена.");
    (await audit(actor, "Правка страницы сайта", `${id}: ${titleRu}`));
    return id;
  }
  const slug = text(input.slug, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length < 2) throw new Error("Укажите адрес страницы латинскими буквами, например delivery.");
  if ((await legacyQuery.get<Row>("SELECT id FROM site_pages WHERE slug=?", [slug]))) throw new Error("Страница с таким адресом уже есть.");
  const next = `page-${randomBytes(6).toString("hex")}`;
  const last = Number((await legacyQuery.get<Row>("SELECT COALESCE(MAX(sort_order),0) AS value FROM site_pages", []))?.value ?? 0);
  (await legacyQuery.run<Row>(`INSERT INTO site_pages(id,slug,title_ru,title_ro,body_ru,body_ro,image,seo_title,seo_description,visible,show_contacts,placement,in_header,sort_order,seeded,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`, [next, slug, titleRu, text(input.titleRo, 120), bodyRu, bodyRo, image, text(input.seoTitle, 180), text(input.seoDescription, 400), visible, showContacts, placement, inHeader, last + 10, new Date().toISOString()]));
  (await audit(actor, "Новая страница сайта", `/${slug}: ${titleRu}`));
  return next;

}));
}

export async function setPageVisible(actor: Staff, id: string, visible: boolean) {
return (await transaction(async () => {
  const result = (await legacyQuery.run<Row>("UPDATE site_pages SET visible=? WHERE id=?", [visible ? 1 : 0, id]));
  if (!result.changes) throw new Error("Страница не найдена.");
  (await audit(actor, visible ? "Страница включена" : "Страница выключена", id));

}));
}

export async function movePage(actor: Staff, id: string, direction: "up" | "down") {
  const pages = (await allPages());
  const index = pages.findIndex((page) => page.id === id);
  if (index < 0) throw new Error("Страница не найдена.");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= pages.length) return;
  
  
  try {
    for (const [position, page] of pages.entries()) {
      const order = position === index ? target : position === target ? index : position;
      await legacyQuery.run<Row>("UPDATE site_pages SET sort_order=? WHERE id=?", [order * 10, page.id]);
    }
    
  } catch (error) {
    
    throw error;
  }
  (await audit(actor, "Порядок страниц", `${id}: ${direction === "up" ? "выше" : "ниже"}`));
}

export async function deletePage(actor: Staff, id: string) {
return (await transaction(async () => {
  const row = (await legacyQuery.get<Row>("SELECT slug,seeded,title_ru FROM site_pages WHERE id=?", [id]));
  if (!row) throw new Error("Страница не найдена.");
  if (Number(row.seeded) === 1) throw new Error("Эту страницу можно только выключить: на неё ссылаются шапка и подвал, и удаление вернуло бы ошибку 404.");
  (await legacyQuery.run<Row>("DELETE FROM site_pages WHERE id=?", [id]));
  (await audit(actor, "Удаление страницы сайта", `/${row.slug}: ${row.title_ru}`));

}));
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

"use client";
// Дерево с перетаскиванием, стрелками порядка и карточкой правки — всё это состояние живёт в браузере.

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import { ChevronDown, ChevronRight, ChevronUp, CornerDownRight, CornerLeftUp, Eye, EyeOff, GripVertical, Pencil, Plus, Trash, X } from "lucide-react";
import { SingleImageField } from "@/components/admin/ImagePicker";
import type { CategoryNode } from "@/lib/reference-db";
import { referenceAction, slugPreview } from "./reference-client";

type Draft = { id: string | null; parentId: string | null; slug: string; nameRu: string; nameRo: string; image: string; intro: string; seoTitle: string; seoDescription: string; visible: boolean };
const empty = (parentId: string | null): Draft => ({ id: null, parentId, slug: "", nameRu: "", nameRo: "", image: "", intro: "", seoTitle: "", seoDescription: "", visible: true });
const toDraft = (node: CategoryNode): Draft => ({ id: node.id, parentId: node.parentId, slug: node.slug, nameRu: node.nameRu, nameRo: node.nameRo, image: node.image, intro: node.intro, seoTitle: node.seoTitle, seoDescription: node.seoDescription, visible: node.visible });

export function CategoryTree({ tree, flat }: { tree: CategoryNode[]; flat: CategoryNode[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CategoryNode | null>(null);
  const [moveTo, setMoveTo] = useState("");

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await referenceAction(body); setNotice(success); router.refresh(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить"); return false; }
    finally { setBusy(false); }
  }

  async function save() {
    if (!draft) return;
    const saved = await run({ action: "save-category", ...draft, slug: draft.slug || slugPreview(draft.nameRu) }, draft.id ? "Категория сохранена" : "Категория создана");
    if (saved) { setDraft(null); setSlugUnlocked(false); }
  }

  const siblingsOf = (parentId: string | null) => (parentId ? flat.find((node) => node.id === parentId)?.children ?? [] : tree);

  async function shift(node: CategoryNode, direction: -1 | 1) {
    const siblings = siblingsOf(node.parentId);
    const position = siblings.findIndex((item) => item.id === node.id);
    const next = position + direction;
    if (next < 0 || next >= siblings.length) return;
    await run({ action: "move-category", id: node.id, parentId: node.parentId, index: next }, "Порядок изменён");
  }

  async function indent(node: CategoryNode) {
    const siblings = siblingsOf(node.parentId);
    const previous = siblings[siblings.findIndex((item) => item.id === node.id) - 1];
    if (!previous) { setError("Вложить можно только под категорию, которая стоит выше в том же уровне."); return; }
    await run({ action: "move-category", id: node.id, parentId: previous.id, index: previous.children.length }, `«${node.nameRu}» вложена в «${previous.nameRu}»`);
  }

  async function outdent(node: CategoryNode) {
    if (!node.parentId) return;
    const parent = flat.find((item) => item.id === node.parentId);
    const grandParent = parent?.parentId ?? null;
    const index = siblingsOf(grandParent).findIndex((item) => item.id === node.parentId) + 1;
    await run({ action: "move-category", id: node.id, parentId: grandParent, index: Math.max(0, index) }, "Категория поднята на уровень выше");
  }

  async function drop(event: DragEvent, node: CategoryNode, mode: "before" | "into") {
    event.preventDefault();
    event.stopPropagation();
    if (!drag || drag === node.id) { setDrag(null); return; }
    const parentId = mode === "into" ? node.id : node.parentId;
    const index = mode === "into" ? node.children.length : siblingsOf(node.parentId).findIndex((item) => item.id === node.id);
    setDrag(null);
    await run({ action: "move-category", id: drag, parentId, index: Math.max(0, index) }, mode === "into" ? `Вложено в «${node.nameRu}»` : "Порядок изменён");
  }

  function rows(nodes: CategoryNode[]): React.ReactNode {
    return nodes.map((node) => <div className="admin-tree-branch" key={node.id}>
      <div className="admin-tree-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void drop(event, node, "before")} />
      <div className={`admin-tree-row ${drag === node.id ? "is-dragging" : ""}`} data-depth={node.depth} draggable onDragEnd={() => setDrag(null)} onDragOver={(event) => event.preventDefault()} onDragStart={() => setDrag(node.id)} onDrop={(event) => void drop(event, node, "into")}>
        <span className="admin-tree-grip" title="Перетащите, чтобы изменить порядок или вложенность"><GripVertical size={16} /></span>
        {node.children.length > 0 ? <button aria-label={collapsed.includes(node.id) ? "Развернуть" : "Свернуть"} className="admin-icon-button" onClick={() => setCollapsed((current) => current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id])} type="button">{collapsed.includes(node.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button> : <span className="admin-tree-spacer" />}
        <div className="admin-tree-name"><strong>{node.nameRu}</strong><small className="admin-muted">/{node.slug}{node.nameRo ? ` · RO: ${node.nameRo}` : ""}</small></div>
        <span className="admin-tree-count">{node.parts} дет. · {node.inStock} в наличии</span>
        {!node.visible && <span className="admin-chip">Скрыта</span>}
        <div className="admin-tree-actions">
          <button aria-label="Выше" className="admin-icon-button" disabled={busy} onClick={() => void shift(node, -1)} type="button"><ChevronUp size={16} /></button>
          <button aria-label="Ниже" className="admin-icon-button" disabled={busy} onClick={() => void shift(node, 1)} type="button"><ChevronDown size={16} /></button>
          <button aria-label="Вложить" className="admin-icon-button" disabled={busy} onClick={() => void indent(node)} type="button"><CornerDownRight size={16} /></button>
          <button aria-label="На уровень выше" className="admin-icon-button" disabled={busy || !node.parentId} onClick={() => void outdent(node)} type="button"><CornerLeftUp size={16} /></button>
          <button aria-label={node.visible ? "Скрыть на сайте" : "Показать на сайте"} className="admin-icon-button" disabled={busy} onClick={() => void run({ action: "save-category", ...toDraft(node), visible: !node.visible }, node.visible ? "Категория скрыта с сайта" : "Категория снова видна на сайте")} type="button">{node.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          <button aria-label="Изменить" className="admin-icon-button" onClick={() => { setDraft(toDraft(node)); setSlugUnlocked(false); setError(""); }} type="button"><Pencil size={16} /></button>
          <button aria-label="Удалить" className="admin-icon-button" onClick={() => { setRemoving(node); setMoveTo(""); setError(""); }} type="button"><Trash size={16} /></button>
        </div>
      </div>
      {node.children.length > 0 && !collapsed.includes(node.id) && <div className="admin-tree-children">{rows(node.children)}</div>}
    </div>);
  }

  return <section className="admin-card">
    <div className="admin-row"><div><h2>Категории каталога</h2><p className="admin-muted">До трёх уровней. Порядок и вложенность меняются стрелками или перетаскиванием. Изменения видны на сайте сразу.</p></div><button className="admin-button" onClick={() => { setDraft(empty(null)); setSlugUnlocked(true); setError(""); }} type="button"><Plus size={16} />Категория</button></div>
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {error && !draft && !removing && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-tree">{tree.length ? rows(tree) : <p className="admin-muted">Категорий пока нет. Создайте первую — она сразу появится в меню каталога.</p>}</div>

    {draft && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <section aria-label="Категория" className="admin-detail" role="dialog">
        <header><h2>{draft.id ? "Категория" : "Новая категория"}</h2><button aria-label="Закрыть" onClick={() => setDraft(null)} type="button"><X size={22} /></button></header>
        <div className="admin-form-grid">
          <label className="admin-field">Название RU<input onChange={(event) => setDraft({ ...draft, nameRu: event.target.value, slug: draft.id && !slugUnlocked ? draft.slug : slugPreview(event.target.value) })} value={draft.nameRu} /></label>
          <label className="admin-field">Название RO<input onChange={(event) => setDraft({ ...draft, nameRo: event.target.value })} placeholder="Для румынской версии" value={draft.nameRo} /></label>
          <label className="admin-field">Адрес страницы
            <input disabled={Boolean(draft.id) && !slugUnlocked} onChange={(event) => setDraft({ ...draft, slug: slugPreview(event.target.value) })} value={draft.slug} />
            <small className="admin-muted">/catalog/legkovye/{draft.slug || "adres"}</small>
            {draft.id && !slugUnlocked && <button className="admin-link-button" onClick={() => setSlugUnlocked(true)} type="button">Изменить адрес — со старого поставим переадресацию</button>}
          </label>
          <label className="admin-field">Родительская категория
            <select onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })} value={draft.parentId ?? ""}>
              <option value="">Верхний уровень</option>
              {flat.filter((node) => node.id !== draft.id && node.depth < 3).map((node) => <option key={node.id} value={node.id}>{"— ".repeat(node.depth - 1)}{node.nameRu}</option>)}
            </select>
          </label>
          <label className="admin-field admin-field-wide">Короткий текст для страницы<textarea onChange={(event) => setDraft({ ...draft, intro: event.target.value })} rows={3} value={draft.intro} /></label>
          <label className="admin-field">Заголовок для поиска<input onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} placeholder={draft.nameRu ? `${draft.nameRu} — NAA.md` : ""} value={draft.seoTitle} /></label>
          <label className="admin-field admin-field-wide">Описание для поиска<textarea onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} rows={2} value={draft.seoDescription} /></label>
          <label className="admin-field admin-field-check"><input checked={draft.visible} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} type="checkbox" /><span>Показывать в меню и на главной</span></label>
        </div>
        <SingleImageField help="Если картинки нет, в меню останется только название." label="Картинка категории" onChange={(next) => setDraft({ ...draft, image: next })} preset="category" value={draft.image} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions"><button className="admin-button" disabled={busy} onClick={() => void save()} type="button">{busy ? "Сохраняем…" : "Сохранить"}</button><button className="admin-ghost-button" onClick={() => setDraft(null)} type="button">Отмена</button></div>
      </section>
    </div>}

    {removing && <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemoving(null); }}>
      <section aria-label="Удаление категории" className="admin-detail" role="dialog">
        <header><h2>Удалить «{removing.nameRu}»?</h2><button aria-label="Закрыть" onClick={() => setRemoving(null)} type="button"><X size={22} /></button></header>
        {removing.children.length > 0 && <p className="admin-note">Внутри есть вложенные категории. Сначала перенесите или удалите их.</p>}
        {removing.parts > 0 && <>
          <p>В категории {removing.parts} дет. Удалить её можно только вместе с переносом деталей.</p>
          <label className="admin-field">Перенести детали в
            <select onChange={(event) => setMoveTo(event.target.value)} value={moveTo}>
              <option value="">Выберите категорию</option>
              {flat.filter((node) => node.id !== removing.id).map((node) => <option key={node.id} value={node.id}>{"— ".repeat(node.depth - 1)}{node.nameRu}</option>)}
            </select>
          </label>
        </>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-image-actions">
          <button className="admin-button" disabled={busy || removing.children.length > 0 || (removing.parts > 0 && !moveTo)} onClick={async () => { if (await run({ action: "delete-category", id: removing.id, moveTo: moveTo || null }, "Категория удалена")) setRemoving(null); }} type="button">Удалить</button>
          <button className="admin-ghost-button" onClick={() => setRemoving(null)} type="button">Отмена</button>
        </div>
      </section>
    </div>}
  </section>;
}

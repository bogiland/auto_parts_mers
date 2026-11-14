"use client";
// Список заказов: новые сверху, фильтры-чипы, красная метка на заказе, который висит дольше получаса.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone, Plus, Search, X } from "lucide-react";
import { money, staffCall, waitingLabel, when } from "@/components/admin/staff-client";
import { OrderCard } from "./OrderCard";

type Row = {
  id: number; number: number; status: string; createdAt: string; name: string; phoneMasked: string;
  totalMdl: number; deliveryCostMdl: number; deliveryTitle: string; source: string; summary: string;
  waitingMinutes: number | null; version: number;
};
type Option = { id: string; title: string; needsAddress?: boolean };
type Found = { id: string; name: string; sku: string; priceMdl: number | null; stock: number; priceMode: string };

const chips = [
  { id: "received", label: "Новые" },
  { id: "confirmed", label: "Подтверждённые" },
  { id: "ready", label: "Готовые" },
  { id: "all", label: "Все" },
] as const;

export function OrderBoard({ rows, statusLabels, deliveryMethods, paymentMethods, viberBase, telegramBase, openNew = false }: {
  rows: Row[]; statusLabels: Record<string, string>; deliveryMethods: Option[]; paymentMethods: Option[];
  viberBase: string; telegramBase: string; openNew?: boolean;
}) {
  const router = useRouter();
  const [chip, setChip] = useState<string>("received");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [adding, setAdding] = useState(openNew);

  const visible = rows.filter((row) => {
    if (chip === "ready" ? !["ready", "shipped"].includes(row.status) : chip !== "all" && row.status !== chip) return false;
    const text = query.trim().toLowerCase();
    return !text || `${row.number} ${row.name} ${row.phoneMasked} ${row.summary}`.toLowerCase().includes(text);
  });
  const count = (id: string) => (id === "all" ? rows.length : id === "ready" ? rows.filter((row) => ["ready", "shipped"].includes(row.status)).length : rows.filter((row) => row.status === id).length);

  return <>
    <div className="admin-row">
      <div className="admin-tabs">
        {chips.map((item) => <button className={chip === item.id ? "is-active" : ""} key={item.id} onClick={() => setChip(item.id)} type="button">{item.label} <small>{count(item.id)}</small></button>)}
      </div>
      <button className="admin-button" onClick={() => setAdding(true)} type="button"><Phone size={16} />Заказ по телефону</button>
    </div>

    <div className="admin-table-tools">
      <input aria-label="Поиск по заказам" onChange={(event) => setQuery(event.target.value)} placeholder="Номер, имя, телефон или деталь" value={query} />
    </div>

    <div className="admin-list">
      {visible.map((row) => <button className="admin-card admin-record admin-order-row" key={row.id} onClick={() => setActive(row.id)} type="button">
        <span className="admin-order-number">№ {row.number}</span>
        <span className="admin-order-date">{when(row.createdAt)}{row.source === "call" ? " · звонок" : ""}</span>
        <span className="admin-order-client">{row.name}<small>{row.phoneMasked}</small></span>
        <span className="admin-order-items">{row.summary || "состав не записан"}</span>
        <span className="admin-order-total">{money(row.totalMdl + row.deliveryCostMdl)}</span>
        <span className="admin-order-status">
          <span className="admin-chip" data-status={row.status}>{statusLabels[row.status] ?? row.status}</span>
          {row.waitingMinutes !== null && row.waitingMinutes >= 30 && <span className="admin-chip admin-chip-alert">{waitingLabel(row.waitingMinutes)}</span>}
        </span>
      </button>)}
      {!visible.length && <div className="admin-card admin-muted">{query ? "Ничего не найдено" : "Заказов в этом разделе нет."}</div>}
    </div>

    {active !== null && <OrderCard
      deliveryMethods={deliveryMethods}
      id={active}
      onChanged={() => router.refresh()}
      onClose={() => setActive(null)}
      paymentMethods={paymentMethods}
      statusLabels={statusLabels}
      telegramBase={telegramBase}
      viberBase={viberBase}
    />}

    {adding && <CallOrderForm deliveryMethods={deliveryMethods} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); router.refresh(); setActive(id); }} paymentMethods={paymentMethods} />}
  </>;
}

function CallOrderForm({ deliveryMethods, paymentMethods, onClose, onCreated }: { deliveryMethods: Option[]; paymentMethods: Option[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [known, setKnown] = useState<string>("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(deliveryMethods[0]?.id ?? "pickup");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.id ?? "receipt");
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [items, setItems] = useState<{ id: string; name: string; quantity: number; priceMdl: number | null; stock: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsAddress = deliveryMethods.find((option) => option.id === deliveryMethod)?.needsAddress;
  const total = items.reduce((sum, item) => sum + (item.priceMdl ?? 0) * item.quantity, 0);

  async function lookup() {
    setKnown("");
    if (!phone.trim()) return;
    try {
      const data = await staffCall<{ client: { name: string; orders: number } | null }>("orders", { action: "client-lookup", phone });
      if (data.client) {
        setKnown(`Клиент уже заказывал: ${data.client.name}, заказов — ${data.client.orders}`);
        if (!name.trim()) setName(data.client.name);
      }
    } catch { /* подсказка не обязательна: без неё заказ всё равно создаётся */ }
  }

  async function find(value: string) {
    setSearch(value);
    if (value.trim().length < 2) { setFound([]); return; }
    try {
      const data = await staffCall<{ parts: Found[] }>("orders", { action: "search-parts", query: value });
      setFound(data.parts ?? []);
    } catch { setFound([]); }
  }

  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label="Новый заказ по телефону" className="admin-detail" role="dialog">
      <header><h2>Заказ по телефону</h2><button aria-label="Закрыть" onClick={onClose} type="button"><X size={22} /></button></header>
      <p className="admin-muted">Источник заказа сохранится как «звонок». Остаток списывается позже, при подтверждении.</p>
      <div className="admin-form-grid">
        <label className="admin-field">Телефон клиента<input onBlur={lookup} onChange={(event) => setPhone(event.target.value)} placeholder="+373 777 45 636" type="tel" value={phone} /></label>
        <label className="admin-field">Имя<input onChange={(event) => setName(event.target.value)} placeholder="Как обращаться" value={name} /></label>
        {known && <p className="admin-note admin-field-wide">{known}</p>}
        <label className="admin-field">Получение<select onChange={(event) => setDeliveryMethod(event.target.value)} value={deliveryMethod}>{deliveryMethods.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>
        <label className="admin-field">Оплата<select onChange={(event) => setPaymentMethod(event.target.value)} value={paymentMethod}>{paymentMethods.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>
        {needsAddress && <label className="admin-field admin-field-wide">Адрес<input onChange={(event) => setAddress(event.target.value)} value={address} /></label>}
        <label className="admin-field admin-field-wide">Комментарий<textarea onChange={(event) => setComment(event.target.value)} rows={2} value={comment} /></label>
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Детали в заказе</h3>
        <label className="admin-field"><span className="admin-row"><Search size={16} />Найти деталь по названию или артикулу</span><input onChange={(event) => void find(event.target.value)} value={search} /></label>
        {found.length > 0 && <div className="admin-list">{found.map((part) => <div className="admin-row" key={part.id}>
          <div className="admin-tree-name"><strong>{part.name}</strong><small className="admin-muted">{part.sku || "без артикула"} · {part.priceMdl === null ? "цена по запросу" : money(part.priceMdl)} · остаток {part.stock}</small></div>
          <button className="admin-icon-button" disabled={items.some((item) => item.id === part.id)} onClick={() => { setItems([...items, { id: part.id, name: part.name, quantity: 1, priceMdl: part.priceMdl, stock: part.stock }]); setFound([]); setSearch(""); }} type="button"><Plus size={16} /></button>
        </div>)}</div>}
        <div className="admin-list">
          {items.map((item) => <div className="admin-row" key={item.id}>
            <div className="admin-tree-name"><strong>{item.name}</strong><small className="admin-muted">{item.priceMdl === null ? "цена по запросу" : money(item.priceMdl)} · остаток {item.stock}</small></div>
            <input aria-label={`Количество: ${item.name}`} className="admin-qty" min="1" onChange={(event) => setItems(items.map((row) => (row.id === item.id ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row)))} type="number" value={item.quantity} />
            <button aria-label="Убрать" className="admin-icon-button" onClick={() => setItems(items.filter((row) => row.id !== item.id))} type="button"><X size={16} /></button>
          </div>)}
          {!items.length && <p className="admin-muted">Пока ничего не добавлено.</p>}
        </div>
        {items.length > 0 && <p className="admin-row"><strong>Итого по деталям: {money(total)}</strong></p>}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-image-actions">
        <button className="admin-button" disabled={busy || !items.length} onClick={async () => {
          setBusy(true); setError("");
          try {
            const data = await staffCall<{ id: number }>("orders", { action: "create-call-order", phone, name, address, comment, deliveryMethod, paymentMethod, items: items.map((item) => ({ id: item.id, quantity: item.quantity })) });
            onCreated(data.id);
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать заказ"); }
          finally { setBusy(false); }
        }} type="button">{busy ? "Создаём…" : "Создать заказ"}</button>
        <button className="admin-ghost-button" onClick={onClose} type="button">Отмена</button>
      </div>
    </section>
  </div>;
}

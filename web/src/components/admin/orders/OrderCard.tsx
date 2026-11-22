"use client";
// Карточка заказа: всё, что оператор делает с заказом, в одном месте.
// Версия заказа едет с каждым изменением — если заказ уже правил другой человек, сервер не даст перезаписать.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, FileDown, MessageSquare, Phone, Printer, Send, X } from "lucide-react";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { money, staffCall, waitingLabel, when } from "@/components/admin/staff-client";
import type { Photo } from "@/lib/photos";

type Item = { productId: string; name: string; sku: string; quantity: number; unitPriceMdl: number; unitPriceRub: number | null; stock: number; returnRestricted: boolean; condition: string };
type History = { from: string; to: string; actor: string; comment: string; at: string };
type ReturnRow = { id: number; productName: string; decision: string; amountMdl: number; reason: string; actor: string; at: string };
export type OrderDetail = {
  id: number; number: number; token: string; status: string; createdAt: string; source: string; name: string;
  phone: string; phoneMasked: string; address: string; comment: string; notes: string; deliveryTitle: string;
  deliveryMethod: string; paymentTitle: string; paymentMethod: string; deliveryCostMdl: number; deliveryCostAgreed: boolean; totalMdl: number;
  totalRub: number | null; againstAdvice: boolean; restricted: boolean; items: Item[]; history: History[];
  issuePhotos: Photo[]; receiptToken: string | null; receiptAt: string | null; stockWritten: boolean;
  cancelReason: string; waitingMinutes: number | null; version: number; next: string[];
};

type Option = { id: string; title: string; needsAddress?: boolean };
export type OrderCardProps = {
  id: number;
  statusLabels: Record<string, string>;
  deliveryMethods: Option[];
  paymentMethods: Option[];
  viberBase: string;
  telegramBase: string;
  onClose: () => void;
  onChanged: () => void;
};

const decisionLabels: Record<string, string> = { full: "Полный возврат", partial: "Частичный возврат", refused: "Отказ" };

export function OrderCard({ id, statusLabels, deliveryMethods, paymentMethods, viberBase, telegramBase, onClose, onChanged }: OrderCardProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [message, setMessage] = useState<{ ru: string; ro: string }>({ ru: "", ro: "" });
  const [language, setLanguage] = useState<"ru" | "ro">("ru");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await staffCall<{ order: OrderDetail; returns: ReturnRow[]; message: { ru: string; ro: string } }>("orders", { action: "order-detail", id });
      setOrder(data.order);
      setReturns(data.returns ?? []);
      setMessage(data.message);
      setDeliveryCost(String(data.order.deliveryCostMdl));
      setNotes(data.order.notes);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть заказ");
    }
  }, [id]);

  // Загрузка идёт в кадре после монтирования: так состояние не меняется прямо в теле эффекта.
  useEffect(() => { const frame = requestAnimationFrame(async () => void (await load())); return () => cancelAnimationFrame(frame); }, [load]);

  async function run(body: Record<string, unknown>, success: string) {
    if (!order) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      await staffCall("orders", { ...body, id: order.id, version: order.version });
      setNotice(success);
      await load();
      onChanged();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label="Заказ" className="admin-detail" role="dialog"><header><h2>Заказ</h2><button aria-label="Закрыть" onClick={onClose} type="button"><X size={22} /></button></header>{error ? <p className="admin-error" role="alert">{error}</p> : <p className="admin-muted">Открываем…</p>}</section>
  </div>;

  const tel = order.phone.replace(/[^\d+]/g, "");
  const viber = viberBase || `viber://chat?number=${encodeURIComponent(tel)}`;
  const telegram = telegramBase || `https://t.me/+${tel.replace(/\D/g, "")}`;
  const goods = order.items.reduce((sum, item) => sum + item.unitPriceMdl * item.quantity, 0);
  const total = goods + Number(deliveryCost || 0);
  const delivery = deliveryMethods.find((option) => option.id === order.deliveryMethod);
  const closing = ["cancelled", "returned"];

  return <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-label={`Заказ № ${order.number}`} className="admin-detail" role="dialog">
      <header>
        <h2>Заказ № {order.number}</h2>
        <button aria-label="Закрыть" onClick={onClose} type="button"><X size={22} /></button>
      </header>

      <div className="admin-row">
        <span className="admin-chip" data-status={order.status}>{statusLabels[order.status] ?? order.status}</span>
        <span className="admin-muted">{when(order.createdAt)} · {order.source === "call" ? "по телефону" : "с сайта"}</span>
        {order.waitingMinutes !== null && order.waitingMinutes >= 30 && <span className="admin-chip admin-chip-alert">{waitingLabel(order.waitingMinutes)}</span>}
      </div>
      {notice && <p className="admin-success" role="status">{notice}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-card admin-sub-card">
        <div className="admin-row">
          <div className="admin-tree-name"><strong>{order.name}</strong><small className="admin-muted">{phone ?? order.phoneMasked}</small></div>
          {!phone && <button className="admin-ghost-button" onClick={async () => { const data = await staffCall<{ phone: string }>("orders", { action: "order-phone", id: order.id }); setPhone(data.phone); }} type="button">Показать номер</button>}
        </div>
        <div className="admin-image-actions">
          <a className="admin-ghost-button" href={`tel:${tel}`}><Phone size={16} />Позвонить</a>
          <a className="admin-ghost-button" href={viber}><MessageSquare size={16} />Viber</a>
          <a className="admin-ghost-button" href={telegram} rel="noreferrer" target="_blank"><Send size={16} />Telegram</a>
        </div>
        {order.comment && <p className="admin-note">Комментарий клиента: {order.comment}</p>}
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Состав</h3>
        <div className="admin-list">
          {order.items.map((item) => <div className="admin-row" key={item.productId}>
            <div className="admin-tree-name">
              <Link href={`/products/${item.productId}`} target="_blank"><strong>{item.name}</strong></Link>
              <small className="admin-muted">{item.sku || "без артикула"}{item.condition ? ` · ${item.condition}` : ""} · {item.quantity} шт. × {money(item.unitPriceMdl)}</small>
            </div>
            <span className="admin-tree-count">
              {order.stockWritten
                ? <>остаток {item.stock} (списано {item.quantity})</>
                : <>остаток {item.stock} → {item.stock - item.quantity}</>}
            </span>
            {item.returnRestricted && <span className="admin-chip admin-chip-alert">без возврата</span>}
          </div>)}
        </div>
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Получение и оплата</h3>
        <div className="admin-tabs">
          {deliveryMethods.map((option) => <button className={option.id === order.deliveryMethod ? "is-active" : ""} disabled={busy} key={option.id} onClick={async () => void (await run({ action: "delivery-method", method: option.id, address: order.address }, "Способ получения изменён"))} type="button">{option.title}</button>)}
        </div>
        {delivery?.needsAddress && <label className="admin-field">Адрес доставки<input defaultValue={order.address} onBlur={async (event) => { if (event.target.value !== order.address) void (await run({ action: "delivery-method", method: order.deliveryMethod, address: event.target.value }, "Адрес сохранён")); }} /></label>}
        <div className="admin-tabs">
          {paymentMethods.map((option) => <button className={option.id === order.paymentMethod ? "is-active" : ""} disabled={busy} key={option.id} onClick={async () => void (await run({ action: "payment-method", method: option.id }, "Способ оплаты изменён"))} type="button">{option.title}</button>)}
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">Стоимость доставки, L.<input min="0" onChange={(event) => setDeliveryCost(event.target.value)} type="number" value={deliveryCost} /></label>
          <div className="admin-field"><span>Итого</span><strong>{money(total)}</strong>{order.totalRub !== null && <small className="admin-muted">товары ≈ {order.totalRub.toLocaleString("ru-RU")} руб</small>}</div>
        </div>
        {!order.deliveryCostAgreed && <p className="admin-warning">Стоимость доставки ещё не согласована. Сохраните 0, если доставка бесплатна или это самовывоз.</p>}
        <button className="admin-button" disabled={busy || (order.deliveryCostAgreed && Number(deliveryCost || 0) === order.deliveryCostMdl)} onClick={async () => void (await run({ action: "delivery-cost", cost: Number(deliveryCost || 0) }, "Стоимость доставки сохранена"))} type="button">Сохранить доставку и пересчитать итог</button>
        <label className="admin-field admin-field-check">
          <input checked={order.againstAdvice} disabled={busy} onChange={async (event) => void (await run({ action: "against-advice", value: event.target.checked }, "Отметка сохранена"))} type="checkbox" />
          Клиент выбрал вопреки рекомендации подборщика
        </label>
        {order.againstAdvice && <p className="admin-warning">По такому выбору возврата не будет — предупредите клиента до выдачи.</p>}
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Что дальше</h3>
        {order.next.length === 0
          ? <p className="admin-muted">Заказ закрыт: {statusLabels[order.status]}. {order.cancelReason && `Причина: ${order.cancelReason}`}</p>
          : <>
              {order.next.some((status) => closing.includes(status)) && <label className="admin-field admin-field-wide">Комментарий (обязателен для отмены и возврата)<textarea onChange={(event) => setComment(event.target.value)} rows={2} value={comment} /></label>}
              <div className="admin-image-actions">
                {order.next.map((status) => <button className={closing.includes(status) ? "admin-ghost-button" : "admin-button"} disabled={busy} key={status} onClick={async () => { if (await run({ action: "order-status", status, comment }, `Статус: ${statusLabels[status]}`)) setComment(""); }} type="button">{statusLabels[status] ?? status}</button>)}
              </div>
              {order.status === "received" && <p className="admin-note">«Подтверждён» списывает остаток. Если деталей не хватает, заказ не подтвердится и покажет, сколько осталось.</p>}
            </>}
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Фото при выдаче</h3>
        <p className="admin-muted">Снимок детали в момент выдачи защищает и покупателя, и магазин при разборе возврата.</p>
        {order.issuePhotos.length > 0 && <div className="admin-gallery-grid">{order.issuePhotos.map((photo) => <figure className="admin-gallery-item" key={photo.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={photo.src} />
        </figure>)}</div>}
        <ImagePicker label="Добавить фото выдачи" onChange={async (next) => { const src = Object.values(next)[0]; if (src) void (await run({ action: "issue-photos", photos: [...order.issuePhotos.map((photo) => ({ src: photo.src, closeup: photo.closeup })), { src, closeup: false }] }, "Фото добавлено")); }} presets={["part"]} value={{}} />
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Сообщение клиенту</h3>
        {order.status==='issued'&&<p className="admin-note">Ссылка для отзыва: <a href="/reviews" target="_blank" rel="noreferrer">страница отзывов</a> <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/reviews`);setCopied(true);}catch{setCopied(false);}}}>Скопировать ссылку</button></p>}
        <div className="admin-tabs">
          <button className={language === "ru" ? "is-active" : ""} onClick={() => setLanguage("ru")} type="button">Русский</button>
          <button className={language === "ro" ? "is-active" : ""} onClick={() => setLanguage("ro")} type="button">Румынский</button>
        </div>
        <textarea className="admin-message" readOnly rows={4} value={message[language]} />
        <button className="admin-ghost-button" onClick={async () => { try { await navigator.clipboard.writeText(message[language]); setCopied(true); } catch { setCopied(false); } }} type="button">{copied ? <><Check size={16} />Скопировано</> : <><Copy size={16} />Скопировать</>}</button>
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Чек</h3>
        {order.receiptToken
          ? <>
              <p className="admin-muted">Чек сформирован {order.receiptAt ? when(order.receiptAt) : ""} и сохранён в заказе — его можно открыть повторно.</p>
              <div className="admin-image-actions">
                <a className="admin-button" href={`/receipt/${order.receiptToken}`} rel="noreferrer" target="_blank"><FileDown size={16} />Открыть чек</a>
                <a className="admin-ghost-button" href={`/receipt/${order.receiptToken}?print=1`} rel="noreferrer" target="_blank"><Printer size={16} />Печать</a>
                <a className="admin-ghost-button" href={`/receipt/${order.receiptToken}?doc=invoice`} rel="noreferrer" target="_blank">Накладная</a>
                <a className="admin-ghost-button" href={`viber://forward?text=${encodeURIComponent(`${message.ru} Чек: ${window.location.origin}/receipt/${order.receiptToken}`)}`}>Отправить в Viber</a>
                <a className="admin-ghost-button" href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/receipt/${order.receiptToken}`)}&text=${encodeURIComponent(message.ru)}`} rel="noreferrer" target="_blank">Отправить в Telegram</a>
              </div>
              <label className="admin-field">Номер фискального чека, если он нужен бухгалтеру<input defaultValue="" onBlur={async (event) => { if (event.target.value.trim()) void (await run({ action: "fiscal-number", value: event.target.value }, "Номер фискального чека сохранён")); }} /></label>
            </>
          : <p className="admin-muted">{order.status === "issued" ? "Нажмите «Чек», чтобы сформировать документ." : "Чек формируется, когда заказ переведён в «Выдан»."}</p>}
        {!order.receiptToken && order.status === "issued" && <button className="admin-button" disabled={busy} onClick={async () => void (await run({ action: "receipt" }, "Чек сформирован"))} type="button">Чек</button>}
      </div>

      <div className="admin-card admin-sub-card">
        <h3>Внутренние заметки</h3>
        <textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
        <button className="admin-ghost-button" disabled={busy || notes === order.notes} onClick={async () => void (await run({ action: "order-notes", notes }, "Заметка сохранена"))} type="button">Сохранить заметку</button>
      </div>

      {returns.length > 0 && <div className="admin-card admin-sub-card">
        <h3>Возвраты по заказу</h3>
        <div className="admin-list">{returns.map((row) => <div className="admin-row" key={row.id}>
          <div className="admin-tree-name"><strong>{row.productName}</strong><small className="admin-muted">{decisionLabels[row.decision] ?? row.decision} · {money(row.amountMdl)} · {row.reason}</small></div>
          <span className="admin-muted">{row.actor} · {when(row.at)}</span>
        </div>)}</div>
      </div>}

      <div className="admin-card admin-sub-card">
        <h3>История</h3>
        <div className="admin-list">
          {order.history.map((entry, index) => <div className="admin-row" key={index}>
            <div className="admin-tree-name"><strong>{entry.from ? `${statusLabels[entry.from] ?? entry.from} → ` : ""}{statusLabels[entry.to] ?? entry.to}</strong>{entry.comment && <small className="admin-muted">{entry.comment}</small>}</div>
            <span className="admin-muted">{entry.actor} · {when(entry.at)}</span>
          </div>)}
          {!order.history.length && <p className="admin-muted">Записей пока нет.</p>}
        </div>
      </div>
    </section>
  </div>;
}

"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OrderResult } from "@/lib/checkout-db";
import { formatRub } from "@/lib/money";
import { OrderPickup } from "./OrderPickup";

const money = formatRub;
export function OrderReceipt({ order }: { order: OrderResult }) {
  const [copied, setCopied] = useState(false);
  const statusUrl = typeof window === "undefined" ? `/order/s/${order.token}` : `${window.location.origin}/order/s/${order.token}`;
  const stages = ["received", "confirmed", "ready", "issued"];
  const stage = Math.max(0, stages.indexOf(order.status));
  const labels = ["Получен", "Подтверждён", order.pickup ? "Готов к выдаче" : "Отправлен", "Выдан"];
  return <main className="container-site min-h-screen py-8 text-ink">
    <div className="mx-auto max-w-3xl rounded-ui bg-white p-6 shadow-card md:p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success text-white"><Check size={28} /></div>
      <h1 className="text-section font-bold">Заказ № {order.number} получен</h1>
      <p className="mt-3 text-body text-ink-2">{order.operatorMessage}</p>
      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Статус заказа">{labels.map((label, index) => <li className={`border-t-4 pt-2 text-meta ${index <= stage ? "border-success text-ink" : "border-line text-ink-2"}`} key={label}>{label}</li>)}</ol>
      <div className="mt-6 border-t border-line pt-4"><h2 className="text-block font-bold">Состав заказа</h2>{order.items.map((item) => <div className="mt-3 flex justify-between gap-4 text-body" key={item.id}><span>{item.name} × {item.quantity}</span><span className="shrink-0">{money(item.unitPriceMdl * item.quantity)}</span></div>)}</div>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-price font-bold"><span>Итого за товары</span><span>{money(order.totalMdl)}</span></div>
      <p className="mt-3 text-body">Получение: {order.deliveryTitle}</p><OrderPickup order={order} />
      <div className="mt-6 flex flex-wrap gap-3">{order.viberUrl ? <a className="rounded-ui border border-accent px-4 py-3 text-btn font-bold text-accent" href={order.viberUrl} rel="noreferrer" target="_blank">Написать в Viber</a> : <button className="rounded-ui border border-line px-4 py-3 text-btn text-ink-2" disabled title="Контакт Viber не настроен">Написать в Viber</button>}{order.telegramUrl ? <a className="rounded-ui border border-accent px-4 py-3 text-btn font-bold text-accent" href={order.telegramUrl} rel="noreferrer" target="_blank">Написать в Telegram</a> : <button className="rounded-ui border border-line px-4 py-3 text-btn text-ink-2" disabled title="Контакт Telegram не настроен">Написать в Telegram</button>}</div>
      <div className="mt-6 flex flex-wrap items-center gap-3 text-body"><Link className="inline-flex h-11 items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" data-order-status-link href={`/order/s/${order.token}`}>Статус заказа</Link><button aria-label="Скопировать ссылку на статус" className="flex items-center gap-2 rounded-ui border border-line px-3 py-2" onClick={async () => { await navigator.clipboard.writeText(statusUrl); setCopied(true); }} type="button"><Copy size={16} />{copied ? "Скопировано" : "Скопировать"}</button></div>
      <Link className="mt-6 inline-flex rounded-ui bg-accent px-4 py-3 text-btn font-bold text-white" href="/catalog/legkovye">Вернуться в каталог</Link>
    </div>
  </main>;
}

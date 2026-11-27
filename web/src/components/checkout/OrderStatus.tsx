import Link from "next/link";
import type { OrderResult } from "@/lib/checkout-db";
import { formatRub } from "@/lib/money";
import { OrderPickup } from "./OrderPickup";

const money = formatRub;

export function OrderStatus({ order }: { order: OrderResult }) {
  const stages = ["received", "confirmed", "ready", "issued"];
  const current = Math.max(0, stages.indexOf(order.status));
  const pickup = order.pickup;
  const labels = ["Получен", "Подтверждён", pickup ? "Готов к выдаче" : "Отправлен", "Выдан"];

  return <main className="container-site min-h-screen bg-surface-2 py-8 text-ink">
    <div className="mx-auto max-w-3xl rounded-ui bg-white p-4 shadow-card md:p-8">
      <h1 className="text-section font-bold">Статус заказа № {order.number}</h1>
      <ol aria-label="Этапы заказа" className="mt-8 grid grid-cols-4 gap-2">
        {labels.map((label, index) => <li aria-current={index === current ? "step" : undefined} className={`min-w-0 border-t-4 pt-2 text-meta ${index <= current ? "border-success text-ink" : "border-line text-ink-2"}`} key={label}>{label}</li>)}
      </ol>
      <section className="mt-8 border-t border-line pt-4">
        <h2 className="text-block font-bold">Состав заказа</h2>
        {order.items.map((item) => <div className="mt-3 flex justify-between gap-4 text-body" key={item.id}><span>{item.name} × {item.quantity}</span><span className="shrink-0">{money(item.unitPriceMdl * item.quantity)}</span></div>)}
      </section>
      <div className="mt-4 flex justify-between gap-4 border-t border-line pt-4 text-price font-bold"><span>Товары</span><span className="text-right">{money(order.totalMdl)}</span></div>
      <p className="mt-4 text-body">Получение: {order.deliveryTitle}</p>
      <OrderPickup order={order} />
      <Link className="mt-8 inline-flex rounded-ui border border-accent px-4 py-3 text-btn font-bold text-accent hover:bg-accent hover:text-white" href="/catalog/legkovye">Вернуться в каталог</Link>
    </div>
  </main>;
}

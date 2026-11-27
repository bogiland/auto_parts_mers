import Link from "next/link";

import { AccountShell } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/customer-auth";
import { customerOrders } from "@/lib/customer-db";
import { getSettings } from "@/lib/checkout-db";

export const metadata = { title: "История заказов — NAA.md" };

const statusLabels: Record<string, string> = {
  received: "Новый", confirmed: "Подтверждён", ready: "Готов к выдаче", shipped: "Отправлен",
  issued: "Выдан", cancelled: "Отменён", returned: "Возврат",
};
const money = (value: number) => `${value.toLocaleString("ru-RU")} руб.`;

export default async function AccountOrdersPage() {
  const customer = await requireCustomer();
  const orders = (await customerOrders(customer));
  const timezone = (await getSettings()).timezone;
  const when = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: timezone }).format(new Date(value));

  return <AccountShell active="/account/orders" title="История заказов">
    <section className="rounded-ui bg-white p-4 shadow-card md:p-6">
      <h2 className="text-block font-bold text-ink">Все заказы</h2>
      <p className="mt-2 text-body text-ink-2">Сюда попадают и заказы, сделанные до регистрации, — мы узнаём их по вашему телефону.</p>

      {orders.length
        ? <ul className="mt-4 flex flex-col gap-4">{orders.map((order) => <li className="rounded-ui border border-line p-4" key={order.token}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-body font-bold text-ink">Заказ № {order.number}</p>
              <span className="text-meta text-ink-2">{when(order.createdAt)}</span>
            </div>
            <p className="mt-1 text-meta text-ink-2">{statusLabels[order.status] ?? order.status} · {order.deliveryTitle} · {order.paymentTitle}</p>
            <ul className="mt-3 flex flex-col gap-1">
              {order.items.map((item) => <li className="flex justify-between gap-4 text-body text-ink" key={item.name}>
                <span className="min-w-0">{item.name} × {item.quantity}</span>
                <span className="shrink-0">{money(item.unitPriceMdl * item.quantity)}</span>
              </li>)}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-price font-bold text-ink">Итого: {money(order.totalMdl + order.deliveryCostMdl)}</span>
              <span className="flex flex-wrap gap-3">
                <Link className="text-body font-bold text-accent hover:underline" href={`/order/s/${order.token}`}>Статус заказа</Link>
                {order.receiptToken && <Link className="text-body font-bold text-accent hover:underline" href={`/receipt/${order.receiptToken}`}>Чек</Link>}
              </span>
            </div>
          </li>)}</ul>
        : <p className="mt-4 text-body text-ink-2">Заказов пока нет. Загляните в <Link className="font-bold text-accent hover:underline" href="/catalog/legkovye">каталог</Link>.</p>}
    </section>
  </AccountShell>;
}

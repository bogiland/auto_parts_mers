import Link from "next/link";

import { AccountShell } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/customer-auth";
import { customerOrders, listAddresses } from "@/lib/customer-db";

export const metadata = { title: "Личный кабинет — NAA.md" };

const statusLabels: Record<string, string> = {
  received: "Новый", confirmed: "Подтверждён", ready: "Готов к выдаче", shipped: "Отправлен",
  issued: "Выдан", cancelled: "Отменён", returned: "Возврат",
};

export default async function AccountPage() {
  const customer = await requireCustomer();
  const orders = customerOrders(customer);
  const addresses = listAddresses(customer.id);
  const open = orders.filter((order) => !["issued", "cancelled", "returned"].includes(order.status));

  return <AccountShell active="/account" title="Мой кабинет">
    <section className="rounded-ui bg-white p-4 shadow-card md:p-6">
      <h2 className="text-block font-bold text-ink">Здравствуйте, {customer.name}</h2>
      <dl className="mt-4 flex flex-col gap-3 text-body">
        <div className="flex gap-2"><dt className="text-ink-2">Имя:</dt><dd className="min-w-0 text-ink">{[customer.name, customer.surname].filter(Boolean).join(" ")}</dd></div>
        <div className="flex gap-2"><dt className="text-ink-2">Почта:</dt><dd className="min-w-0 text-ink">{customer.email}</dd></div>
        <div className="flex gap-2"><dt className="text-ink-2">Телефон:</dt><dd className="min-w-0 text-ink">{customer.phone}</dd></div>
        <div className="flex gap-2"><dt className="text-ink-2">Адресов сохранено:</dt><dd className="text-ink">{addresses.length}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href="/account/edit">Изменить данные</Link>
        <Link className="inline-flex h-btn items-center rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" href="/account/orders">История заказов</Link>
      </div>
    </section>

    <section className="mt-6 rounded-ui bg-white p-4 shadow-card md:p-6">
      <h2 className="text-block font-bold text-ink">Заказы в работе</h2>
      {open.length
        ? <ul className="mt-4 flex flex-col gap-3">{open.map((order) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-ui border border-line p-4" key={order.token}>
            <div className="min-w-0">
              <p className="text-body font-bold text-ink">Заказ № {order.number}</p>
              <p className="mt-1 text-meta text-ink-2">{order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-body text-ink-2">{statusLabels[order.status] ?? order.status}</span>
              <Link className="text-body font-bold text-accent hover:underline" href={`/order/s/${order.token}`}>Статус</Link>
            </div>
          </li>)}</ul>
        : <p className="mt-2 text-body text-ink-2">Сейчас заказов в работе нет. Все прошлые — в истории заказов.</p>}
    </section>
  </AccountShell>;
}

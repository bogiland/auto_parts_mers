import { MapPin, Phone } from "lucide-react";

import type { OrderResult } from "@/lib/checkout-db";
import { mapUrl, messenger, storeHours } from "@/lib/store-info";

/**
 * Куда ехать и что дальше — на экране «Заказ получен» и в статусе заказа.
 * Самовывоз: адрес, карта, часы склада, телефон, Viber, оплата и «позвоните перед приездом».
 * Доставка: перезвоним и договоримся о способе и цене — тарифов в форме нет.
 */
export function OrderPickup({ order }: { order: Pick<OrderResult, "pickup" | "pickupAddress" | "phone" | "paymentTitle" | "deliveryTitle"> }) {
  if (!order.pickup) return <section className="mt-6 rounded-ui bg-surface-2 p-4" data-order-delivery>
    <h2 className="text-block font-bold">Доставка</h2>
    <p className="mt-2 text-body">Перезвоним и договоримся о способе и цене доставки: маршруткой, нашей машиной или почтой — в любую точку ПМР и Молдовы.</p>
    <p className="mt-1 text-body">Оплата: {order.paymentTitle}</p>
  </section>;

  const tel = order.phone.replace(/[^\d+]/g, "");
  return <section className="mt-6 grid gap-2 rounded-ui bg-surface-2 p-4" data-order-pickup>
    <h2 className="text-block font-bold">Самовывоз</h2>
    <p className="flex items-start gap-2 text-body"><MapPin aria-hidden="true" className="mt-1 shrink-0 text-accent" size={18} /><span><b>{order.pickupAddress}</b> · <a className="text-accent underline hover:text-accent-hover" href={mapUrl(order.pickupAddress)} rel="noreferrer" target="_blank">Открыть на карте</a></span></p>
    <p className="text-body" data-pickup-hours>Склад: {storeHours.warehouse}</p>
    <p className="text-body">Оплата: {order.paymentTitle}</p>
    <p className="text-body font-bold">Позвоните перед приездом — подготовим деталь к выдаче.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {tel ? <a className="inline-flex h-11 items-center gap-2 rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" href={`tel:${tel}`}><Phone aria-hidden="true" size={16} />{order.phone}</a> : null}
      <a className="inline-flex h-11 items-center rounded-ui border border-line bg-white px-4 text-btn font-bold text-ink hover:text-accent" href={messenger.viber}>Viber {messenger.label}</a>
    </div>
  </section>;
}

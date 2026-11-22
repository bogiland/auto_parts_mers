import { notFound } from "next/navigation";

import { ReceiptActions } from "@/components/receipt/ReceiptActions";
import { receiptByToken } from "@/lib/orders-db";
import { qrSvg } from "@/lib/qr";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ doc?: string; print?: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Товарный чек — NAA.md", robots: { index: false, follow: false } };

const money = (value: number) => `${value.toLocaleString("ru-RU")} L.`;
const when = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default async function ReceiptPage({ params, searchParams }: Props) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const receipt = (await receiptByToken(token));
  if (!receipt) notFound();
  const invoice = query.doc === "invoice";
  const title = invoice ? receipt.invoiceTitle : "Товарный чек";

  return <main className="container-site py-8 text-ink">
    {/* Печать на A4: убираем всё лишнее и фиксируем поля. */}
    <style>{"@page{size:A4;margin:14mm}@media print{.receipt-actions{display:none}.receipt-sheet{box-shadow:none;padding:0}}"}</style>
    <div className="receipt-sheet mx-auto max-w-3xl rounded-ui bg-white p-4 shadow-card md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="text-block font-bold">{receipt.header}</p>
          <p className="mt-2 whitespace-pre-line text-meta text-ink-2">{receipt.requisites}</p>
          {(receipt.phonePmr || receipt.phoneMoldova) && <p className="mt-2 text-meta text-ink-2">Телефон: {[receipt.phonePmr, receipt.phoneMoldova].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="shrink-0 text-right">
          {/* QR ведёт на страницу статуса заказа: клиент наводит камеру и видит, где его деталь. */}
          <div className="inline-block" dangerouslySetInnerHTML={{ __html: qrSvg(receipt.statusUrl, 108) }} />
          <p className="mt-1 text-meta text-ink-2">Статус заказа</p>
        </div>
      </header>

      <h1 className="mt-6 text-section font-bold">{title} к заказу № {receipt.number}</h1>
      <p className="mt-1 text-meta text-ink-2">Заказ оформлен {when(receipt.createdAt)}{receipt.issuedAt ? ` · выдан ${when(receipt.issuedAt)}` : ""} · документ сформировал {receipt.madeBy}</p>

      <section className="mt-6">
        <h2 className="text-block font-bold">Покупатель</h2>
        <p className="mt-2 text-body">{receipt.clientName} · {receipt.clientPhone}</p>
        <p className="mt-1 text-body text-ink-2">Получение: {receipt.deliveryTitle}{receipt.address ? `, ${receipt.address}` : ""}</p>
        <p className="mt-1 text-body text-ink-2">Оплата: {receipt.paymentTitle}</p>
      </section>

      <section className="mt-6 min-w-0">
        <h2 className="text-block font-bold">Детали</h2>
        <table className="mt-3 w-full border-collapse text-body">
          <thead><tr className="border-b border-line text-left text-meta text-ink-2">
            <th className="py-2 pr-2 font-medium">Деталь</th>
            <th className="py-2 pr-2 font-medium">Артикул</th>
            <th className="py-2 pr-2 font-medium">Состояние</th>
            <th className="py-2 pr-2 text-right font-medium">Кол.</th>
            <th className="py-2 text-right font-medium">Сумма</th>
          </tr></thead>
          <tbody>{receipt.items.map((item) => <tr className="border-b border-line align-top" key={`${item.sku}-${item.name}`}>
            <td className="py-2 pr-2">{item.name}</td>
            <td className="py-2 pr-2 text-meta text-ink-2">{item.sku || "—"}</td>
            <td className="py-2 pr-2 text-meta text-ink-2">{item.condition || "—"}</td>
            <td className="py-2 pr-2 text-right">{item.quantity}</td>
            <td className="py-2 text-right">{money(item.priceMdl * item.quantity)}{item.priceRub !== null ? <span className="block text-meta text-ink-2">{(item.priceRub * item.quantity).toLocaleString("ru-RU")} руб</span> : null}</td>
          </tr>)}</tbody>
        </table>
      </section>

      <section className="mt-4 flex flex-col items-end gap-1 text-body">
        <p>Детали: {money(receipt.goodsMdl)}</p>
        {receipt.deliveryMdl > 0 && <p>Доставка: {money(receipt.deliveryMdl)}</p>}
        <p className="text-price font-bold">Итого: {money(receipt.totalMdl)}</p>
        {receipt.totalRub !== null && <p className="text-meta text-ink-2">≈ {receipt.totalRub.toLocaleString("ru-RU")} руб ПМР по курсу магазина{receipt.rubPerMdl ? ` (1 L. = ${receipt.rubPerMdl} руб)` : ""}</p>}
      </section>

      <section className="mt-6 border-t border-line pt-4">
        <h2 className="text-block font-bold">Гарантия и возврат</h2>
        <p className="mt-2 text-body text-ink-2">{receipt.warranty}</p>
        {receipt.restricted && <p className="mt-2 text-body font-bold">В этом заказе есть агрегат в сборе — он возврату не подлежит.</p>}
        {receipt.againstAdvice && <p className="mt-2 text-body">Клиент выбрал деталь вопреки рекомендации подборщика — возврат по этой причине не производится.</p>}
      </section>

      <section className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4 text-body">
        <p className="min-w-0">{receipt.signature}</p>
        {invoice && <p className="min-w-0">Деталь получил: ____________________</p>}
      </section>

      <p className="mt-4 text-meta text-ink-2">
        Это товарный чек — подтверждение покупки. {receipt.fiscalNumber ? `Номер фискального чека: ${receipt.fiscalNumber}.` : "Фискальный чек, если он нужен, оформляется отдельно по правилам ПМР."}
      </p>

      <div className="mt-6"><ReceiptActions autoPrint={query.print === "1"} /></div>
      <p className="receipt-actions mt-2 text-meta text-ink-2">Второй документ: <a className="underline hover:text-accent" href={`/receipt/${token}${invoice ? "" : "?doc=invoice"}`}>{invoice ? "товарный чек" : receipt.invoiceTitle}</a></p>
    </div>
  </main>;
}

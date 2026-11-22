import Link from "next/link";
import { one } from "@/lib/db";

type Metrics = { revenue: string; orders: string; gross: string; missing: string; returns: string };
const periods = [{ id: "7", label: "7 дней", days: 7 }, { id: "30", label: "30 дней", days: 30 }, { id: "90", label: "Квартал", days: 90 }, { id: "365", label: "Год", days: 365 }];
const money = (n: number) => `${n.toLocaleString("ru-RU")} MDL`;
const currentTime = () => Date.now();

async function metrics(from: string, to: string) {
  return await one<Metrics>(`SELECT
    (SELECT COALESCE(SUM(total_mdl),0) FROM orders WHERE status='issued' AND issued_at >= $1 AND issued_at < $2) AS revenue,
    (SELECT COUNT(*) FROM orders WHERE status='issued' AND issued_at >= $1 AND issued_at < $2) AS orders,
    (SELECT COALESCE(SUM(i.quantity*(i.unit_price_mdl-i.unit_cost_mdl)),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='issued' AND o.issued_at >= $1 AND o.issued_at < $2) AS gross,
    (SELECT COUNT(*) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='issued' AND o.issued_at >= $1 AND o.issued_at < $2 AND i.unit_cost_mdl IS NULL) AS missing,
    (SELECT COUNT(*) FROM order_status_history WHERE to_status='returned' AND at >= $1 AND at < $2) AS returns`, [from, to]);
}

export async function OwnerDashboard({ period }: { period?: string }) {
  const selected = periods.find(p => p.id === period) ?? periods[1]!;
  const now = currentTime(), span = selected.days * 86400000;
  const [current, previous, alerts] = await Promise.all([
    metrics(new Date(now - span).toISOString(), new Date(now + 1).toISOString()),
    metrics(new Date(now - 2 * span).toISOString(), new Date(now - span).toISOString()),
    one<{ overdue: string; no_photo: string; no_price: string; no_ro: string }>(`SELECT
      (SELECT COUNT(*) FROM orders WHERE status='received' AND created_at < $1) AS overdue,
      (SELECT COUNT(*) FROM catalog_products WHERE COALESCE(hidden,0)=0 AND sku IS NOT NULL AND photos_json='[]') AS no_photo,
      (SELECT COUNT(*) FROM catalog_products WHERE COALESCE(hidden,0)=0 AND sku IS NOT NULL AND price_mdl IS NULL) AS no_price,
      (SELECT COUNT(*) FROM catalog_products WHERE COALESCE(hidden,0)=0 AND sku IS NOT NULL AND COALESCE(name_ro,'')='') AS no_ro`, [new Date(now - 7200000).toISOString()]),
  ]);
  const rows = [
    { label: "Выручка выданных заказов", value: Number(current?.revenue ?? 0), previous: Number(previous?.revenue ?? 0), monetary: true },
    { label: "Выданные заказы", value: Number(current?.orders ?? 0), previous: Number(previous?.orders ?? 0) },
    { label: "Средний чек", value: Number(current?.orders) ? Math.round(Number(current?.revenue) / Number(current?.orders)) : 0, previous: Number(previous?.orders) ? Math.round(Number(previous?.revenue) / Number(previous?.orders)) : 0, monetary: true },
    { label: "Валовая прибыль по известной себестоимости", value: Number(current?.gross ?? 0), previous: Number(previous?.gross ?? 0), monetary: true, note: Number(current?.missing) ? `Без себестоимости: ${current?.missing} поз.` : "Без расходов и доставки" },
    { label: "Возвраты", value: Number(current?.returns ?? 0), previous: Number(previous?.returns ?? 0) },
  ];
  return <div className="admin-list"><nav className="admin-tabs" aria-label="Период">{periods.map(p => <Link className={p.id === selected.id ? "is-active" : ""} href={`/admin/dashboard?period=${p.id}`} key={p.id}>{p.label}</Link>)}</nav>
    <p className="admin-muted">Сравнение с предыдущими {selected.days} днями. Выручка учитывает заказы в статусе «Выдан»; возвращённые заказы исключены целиком.</p>
    <div className="admin-grid">{rows.map(row => <div className="admin-card admin-stat" key={row.label}><small>{row.label}</small><strong>{row.monetary ? money(row.value) : row.value}</strong><p className="admin-muted">Предыдущий период: {row.monetary ? money(row.previous) : row.previous}{row.note ? ` · ${row.note}` : ""}</p></div>)}</div>
    <h2>Требует внимания</h2><div className="admin-grid"><Link className="admin-card" href="/admin/orders">Новые заказы старше 2 часов: {Number(alerts?.overdue ?? 0)}</Link><Link className="admin-card" href="/admin/inventory">Без фото: {Number(alerts?.no_photo ?? 0)} · без цены: {Number(alerts?.no_price ?? 0)} · без RO: {Number(alerts?.no_ro ?? 0)}</Link></div>
  </div>;
}

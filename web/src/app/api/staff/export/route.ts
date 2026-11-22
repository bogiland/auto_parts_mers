import { currentStaff } from "@/lib/staff-auth";
import { audit, exportOrders } from "@/lib/staff-db";

export const runtime = "nodejs";
const csv = (value: unknown) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
export async function GET() {
  const staff = await currentStaff();
  if (!staff) return new Response(null, { status: 401 });
  if (staff.role !== "owner") return new Response(null, { status: 404 });
  const rows = (await exportOrders());
  const lines = ["Номер,Дата,Статус,Имя,Телефон,Получение,Сумма L.", ...rows.map((row) => [Number(row.id) + 1000, row.created_at, row.status, row.name, row.phone, row.delivery_title, row.total_mdl].map(csv).join(","))];
  (await audit(staff, "Экспорт заказов", `${rows.length} строк`));
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=naa-orders.csv", "Cache-Control": "no-store" } });
}

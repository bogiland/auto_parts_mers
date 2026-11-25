import { currentStaff } from "@/lib/staff-auth";
import { audit, consumeConfirmation, exportOrders } from "@/lib/staff-db";

export const runtime = "nodejs";

/**
 * Первая ячейка строки, начинающаяся с =, +, @ или минуса, в Excel выполняется как формула.
 * Апостроф перед ней превращает её обратно в текст.
 */
const csv = (value: unknown) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;

export async function GET() {
  const staff = await currentStaff();
  if (!staff) return new Response(null, { status: 401 });
  if (staff.role !== "owner") return new Response(null, { status: 404 });
  // Выгрузка уносит из системы телефоны всех покупателей разом. Живой куки для этого мало:
  // пароль вводится заново, и подтверждение тратится на эту одну выгрузку.
  if (!(await consumeConfirmation(staff, "export"))) {
    return Response.json({ message: "Подтвердите выгрузку паролем.", needConfirm: "export" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const rows = (await exportOrders());
  const lines = ["Номер,Дата,Статус,Имя,Телефон,Получение,Сумма L.", ...rows.map((row) => [Number(row.id) + 1000, row.created_at, row.status, row.name, row.phone, row.delivery_title, row.total_mdl].map(csv).join(","))];
  (await audit(staff, "Экспорт заказов", `${rows.length} строк`));
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=naa-orders.csv",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

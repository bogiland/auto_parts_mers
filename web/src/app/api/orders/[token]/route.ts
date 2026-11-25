import { getOrderByToken } from "@/lib/checkout-db";
import { clientIp } from "@/lib/http";
import { allow, tooMany, windows } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Статус заказа по ссылке. Токен — единственный пропуск, поэтому:
 *  — предел на число попыток с адреса закрывает перебор случайных токенов;
 *  — сам токен никуда не записывается: ни в журнал, ни в текст ошибки.
 *    Запись «не найден токен такой-то» в логе равна выдаче чужой ссылки тому,
 *    кто этот лог читает.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!/^[a-f0-9-]{36}$/i.test(token)) return Response.json({ message: "Заказ не найден" }, { status: 404, headers });
  if (!(await allow("order-status:ip", clientIp(request), windows.orderStatusIp))) return tooMany();
  const order = (await getOrderByToken(token));
  return order
    ? Response.json(order, { headers })
    : Response.json({ message: "Заказ не найден" }, { status: 404, headers });
}

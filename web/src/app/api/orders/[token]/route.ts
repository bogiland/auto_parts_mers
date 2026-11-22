import { getOrderByToken } from "@/lib/checkout-db";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(token)) return Response.json({ message: "Заказ не найден" }, { status: 404 });
  const order = (await getOrderByToken(token));
  return order ? Response.json(order, { headers: { "Cache-Control": "no-store" } }) : Response.json({ message: "Заказ не найден" }, { status: 404 });
}

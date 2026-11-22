import { currentCustomer } from "@/lib/customer-auth";
import { listAddresses } from "@/lib/customer-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Нужен оформлению заказа: если покупатель вошёл, его имя, телефон и адрес подставляются сами.
export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return Response.json({ customer: null }, { headers: { "Cache-Control": "no-store" } });
  return Response.json({ customer, addresses: (await listAddresses(customer.id)) }, { headers: { "Cache-Control": "no-store" } });
}

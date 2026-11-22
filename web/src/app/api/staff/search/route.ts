import { cookies } from "next/headers";
import { cookieName } from "@/lib/staff-auth";
import { listInquiries, listInventory, listOrders, maskPhone, session } from "@/lib/staff-db";
import { homepageSeed } from "@/data/homepage.seed";

export const runtime = "nodejs";
export async function GET(request: Request) { return (await search(request)); }
async function search(request: Request) {
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ results: [] });
  const skuById = new Map([...homepageSeed.popularProducts, ...homepageSeed.recommendedProducts].map((product) => [product.id, product.sku]));
  const results = [
    ...(await listOrders()).filter((row) => `${row.id} ${Number(row.id) + 1000} ${row.name} ${row.phone}`.toLowerCase().includes(q)).slice(0, 6).map((row) => ({ group: "Заказы", label: `Заказ № ${Number(row.id) + 1000}`, meta: `${row.name} · ${maskPhone(String(row.phone))}`, href: `/admin/orders?q=${Number(row.id) + 1000}` })),
    ...(["expert", "catalog"] as const).flatMap(async (source) => (await listInquiries(source)).filter((row) => `${row.id} ${row.part} ${row.phone}`.toLowerCase().includes(q)).slice(0, 3).map((row) => ({ group: source === "expert" ? "Обращения" : "Заявки", label: `Заявка № ${row.id}`, meta: `${row.part} · ${maskPhone(String(row.phone))}`, href: `/admin/${source === "catalog" ? "applications" : "requests"}?q=${row.id}` }))),
    ...(await listInventory()).filter((row) => `${row.id} ${row.name} ${skuById.get(String(row.id)) ?? ""}`.toLowerCase().includes(q)).slice(0, 7).map((row) => ({ group: "Детали", label: String(row.name), meta: `Артикул / SKU: ${skuById.get(String(row.id)) ?? row.id}`, href: `/admin/inventory?q=${encodeURIComponent(String(row.id))}` })),
  ];
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

import { getCheckoutCatalog } from "@/lib/checkout-db";

export const runtime = "nodejs";
export async function GET() { return Response.json((await getCheckoutCatalog()), { headers: { "Cache-Control": "no-store" } }); }

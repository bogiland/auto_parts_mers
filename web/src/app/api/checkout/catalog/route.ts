import { getCheckoutCatalog } from "@/lib/checkout-db";

export const runtime = "nodejs";
export function GET() { return Response.json(getCheckoutCatalog(), { headers: { "Cache-Control": "no-store" } }); }

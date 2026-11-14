import { getSettings } from "@/lib/checkout-db";

export const runtime = "nodejs";
export function GET() { return Response.json(getSettings(), { headers: { "Cache-Control": "no-store" } }); }

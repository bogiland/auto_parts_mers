import { getSettings } from "@/lib/checkout-db";

export const runtime = "nodejs";
export async function GET() { return Response.json((await getSettings()), { headers: { "Cache-Control": "no-store" } }); }

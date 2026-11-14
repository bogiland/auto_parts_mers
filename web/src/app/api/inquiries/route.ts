import { isValidPhoneNumber } from "libphonenumber-js";
import { createInquiry } from "@/lib/staff-db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const part = typeof body?.part === "string" ? body.part.trim() : "";
  const vehicle = typeof body?.vehicle === "string" ? body.vehicle.trim() : "";
  const source = body?.source;
  if (!isValidPhoneNumber(phone) || !part || part.length > 200 || vehicle.length > 200 || !["expert", "catalog"].includes(source)) return Response.json({ message: "Проверьте телефон и название детали." }, { status: 400 });
  try { return Response.json({ id: createInquiry(phone, part, vehicle, source) }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : "Не удалось отправить заявку." }, { status: 429 }); }
}

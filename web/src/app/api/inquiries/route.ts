import { isValidPhoneNumber } from "libphonenumber-js";
import { createInquiry } from "@/lib/staff-db";
import { BodyTooLarge, bodyLimits, clientIp, humanOrFallback, logFailure, readJson, sameOriginRequest } from "@/lib/http";
import { allow, tooMany, windows } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.form); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return Response.json({ message: "Проверьте телефон и название детали." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const part = typeof body.part === "string" ? body.part.trim() : "";
  const vehicle = typeof body.vehicle === "string" ? body.vehicle.trim() : "";
  const source = body.source;
  if (!isValidPhoneNumber(phone) || !part || part.length > 200 || vehicle.length > 200 || !["expert", "catalog"].includes(source as string)) {
    return Response.json({ message: "Проверьте телефон и название детали." }, { status: 400 });
  }

  // Предел по номеру уже есть внутри createInquiry; здесь добавлен предел по адресу,
  // иначе один бот с набором чужих номеров обходит счётчик целиком.
  const ip = clientIp(request);
  if (!(await allow("inquiry:ip", ip, windows.inquiryIp))) return tooMany();

  try {
    const id = await createInquiry(phone, part, vehicle, source as "expert" | "catalog");
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = humanOrFallback(error, "Не удалось отправить заявку.");
    if (message === "Не удалось отправить заявку.") logFailure("Заявка эксперту", error, { ip });
    return Response.json({ message }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}

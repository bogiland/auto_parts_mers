import { isValidPhoneNumber } from "libphonenumber-js";
import { createInquiry, toInternational } from "@/lib/staff-db";
import { BodyTooLarge, bodyLimits, clientIp, humanOrFallback, logFailure, readJson, sameOriginRequest } from "@/lib/http";
import { partByPublicId } from "@/lib/parts-db";
import { allow, tooMany, windows } from "@/lib/rate-limit";
import { isAfterHours } from "@/lib/working-hours";

export const runtime = "nodejs";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.form); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return Response.json({ message: "Проверьте телефон и название детали." }, { status: 400 });
  }

  // Номер приводится к одному виду до проверки: 68123456, 068 123 456 и +373 68 123 456 —
  // один и тот же человек. Раньше местный набор отклонялся здесь и принимался в заказе.
  const phone = toInternational(typeof body.phone === "string" ? body.phone : "");
  let part = text(body.part, 200);
  const vehicle = text(body.vehicle, 200);
  const query = text(body.query, 120);
  const source = body.source;
  if (!phone || !isValidPhoneNumber(phone)) return Response.json({ field: "phone", message: "Проверьте номер телефона: например, +373 68 123 456." }, { status: 400 });
  if (!["expert", "catalog"].includes(source as string)) return Response.json({ message: "Обновите страницу и повторите." }, { status: 400 });

  // «Узнать цену» присылает только номер детали в каталоге. Название, OEM и донора
  // берём из базы, а не из запроса: так оператор видит настоящую деталь, а не то, что прислали.
  let details: { productId?: string | null; oem?: string; donor?: string; query?: string } = { query };
  const productId = text(body.productId, 80);
  if (productId) {
    const product = await partByPublicId(productId);
    if (!product || product.hidden) return Response.json({ message: "Эта деталь уже снята с продажи. Опишите, что ищете, в форме подбора." }, { status: 404 });
    part = product.nameRu;
    details = { productId: product.id, oem: product.oem, donor: product.donorTitle, query };
  } else if (query && !part) {
    part = query;
  }
  if (!part || part.length < 2) return Response.json({ field: "part", message: "Напишите, какая деталь нужна." }, { status: 400 });
  // Похоже на номер детали — кладём и в поле OEM, чтобы оператор искал сразу по нему.
  if (!details.oem && query && /\d/.test(query) && /^[a-z0-9 .\-]{5,}$/i.test(query)) details.oem = query;

  const ip = clientIp(request);
  if (!(await allow("inquiry:ip", ip, windows.inquiryIp))) return tooMany();

  try {
    const id = await createInquiry(phone, part, vehicle, source as "expert" | "catalog", details);
    return Response.json({ id, afterHours: isAfterHours() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = humanOrFallback(error, "Не удалось отправить заявку.");
    if (message === "Не удалось отправить заявку.") logFailure("Заявка эксперту", error, { ip });
    return Response.json({ message }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}

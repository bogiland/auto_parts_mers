import { applyVacancy } from "@/lib/vacancies";
import { BodyTooLarge, bodyLimits, clientIp, humanOrFallback, logFailure, readJson, sameOriginRequest } from "@/lib/http";
import { allow, tooMany, windows } from "@/lib/rate-limit";
import { toInternational } from "@/lib/staff-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.form); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return new Response(null, { status: 400 });
  }

  // Предел по адресу и по номеру — раздельно, как на оформлении заказа.
  const ip = clientIp(request);
  if (!(await allow("apply:ip", ip, windows.applyIp))) return tooMany();
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (phone && !(await allow("apply:phone", toInternational(phone) || phone, windows.applyPhone))) return tooMany();

  try {
    await applyVacancy(body);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Наружу идут только наши собственные понятные сообщения; текст ошибки базы — нет.
    const message = humanOrFallback(error, "Не удалось отправить отклик. Попробуйте позже.");
    if (message !== "Не удалось отправить отклик. Попробуйте позже.") return Response.json({ message }, { status: 400 });
    const reference = logFailure("Отклик на вакансию", error, { ip });
    return Response.json({ message, reference }, { status: 400 });
  }
}

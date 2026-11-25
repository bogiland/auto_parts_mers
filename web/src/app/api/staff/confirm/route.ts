import { cookies } from "next/headers";
import { cookieName } from "@/lib/staff-auth";
import { checkOwnPassword, confirmedActions, confirmTtlMs, hasConfirmation, recordConfirmation, session } from "@/lib/staff-db";
import { BodyTooLarge, bodyLimits, clientIp, readJson, sameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Повторный ввод пароля перед сменой ролей и выгрузкой заказов.
 * Ответ одинаков для неверного пароля и для исчерпанного предела попыток,
 * чтобы по ответу нельзя было определить, угадан пароль или нет.
 */
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });
  const staff = (await session((await cookies()).get(cookieName)?.value));
  if (!staff) return new Response(null, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.form); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return new Response(null, { status: 400 });
  }

  const scope = String(body.scope ?? "");
  if (!confirmedActions.has(scope)) return new Response(null, { status: 400 });

  if (body.action === "check") {
    return Response.json({ confirmed: await hasConfirmation(staff, scope) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!(await checkOwnPassword(staff, String(body.password ?? ""), clientIp(request)))) {
    return Response.json({ message: "Неверный пароль." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await recordConfirmation(staff, scope);
  return Response.json({ ok: true, validForMs: confirmTtlMs }, { headers: { "Cache-Control": "no-store" } });
}

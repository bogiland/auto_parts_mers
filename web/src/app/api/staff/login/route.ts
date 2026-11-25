import { cookies } from "next/headers";
import { cookieName, sessionCookieOptions } from "@/lib/staff-auth";
import { login } from "@/lib/staff-db";
import { BodyTooLarge, bodyLimits, clientIp, readJson, sameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.form); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return Response.json({ message: "Неверный телефон или пароль" }, { status: 401 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (phone.length > 50 || password.length > 200) return Response.json({ message: "Неверный телефон или пароль" }, { status: 401 });

  // Пределы на подбор пароля живут внутри login(): отдельно по адресу, отдельно по номеру.
  const result = (await login(phone, password, clientIp(request)));
  if (!result) return Response.json({ message: "Неверный телефон или пароль" }, { status: 401 });

  // У владельца сессия короче: с его доступом меняют права, цены и выгружают данные.
  (await cookies()).set(cookieName, result.token, sessionCookieOptions(result.staff.role));
  return Response.json({ role: result.staff.role }, { headers: { "Cache-Control": "no-store" } });
}

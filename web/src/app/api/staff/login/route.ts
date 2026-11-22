import { cookies } from "next/headers";
import { cookieName, cookieOptions, sameOrigin } from "@/lib/staff-auth";
import { login } from "@/lib/staff-db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (phone.length > 50 || password.length > 200) return Response.json({ message: "Неверный телефон или пароль" }, { status: 401 });
  const result = (await login(phone, password));
  if (!result) return Response.json({ message: "Неверный телефон или пароль" }, { status: 401 });
  (await cookies()).set(cookieName, result.token, cookieOptions);
  return Response.json({ role: result.staff.role }, { headers: { "Cache-Control": "no-store" } });
}

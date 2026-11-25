import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { session, type Role, type Staff } from "@/lib/staff-db";

export const cookieName = "naa_staff_session";

/**
 * Срок жизни куки сессии зависит от прав.
 *
 * У оператора смена длинная и машина своя — ему удобнее не входить заново каждый день.
 * У владельца тем же доступом меняют права сотрудников, цены и выгружают заказы
 * с телефонами: забытая в чужом браузере вкладка стоит слишком дорого, поэтому
 * его кука живёт сутки, а бездействие обрывает сессию через полчаса (`idleMs` в staff-db).
 */
export function sessionCookieOptions(role: Role) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: role === "owner" ? 24 * 60 * 60 : 30 * 24 * 60 * 60,
  };
}

/** Прежнее имя: сохранено для совместимости со старым кодом. */
export const cookieOptions = sessionCookieOptions("operator");
export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(cookieName)?.value;
  return (await session(token));
}
export async function requireStaff(role?: Role): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (role && staff.role !== role) notFound();
  return staff;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

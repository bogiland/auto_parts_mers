import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { session, type Role, type Staff } from "@/lib/staff-db";

export const cookieName = "naa_staff_session";
export const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 60 * 60 };
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

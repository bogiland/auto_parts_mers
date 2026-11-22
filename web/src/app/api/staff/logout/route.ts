import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { logout } from "@/lib/staff-db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const jar = await cookies();
  (await logout(jar.get(cookieName)?.value, new URL(request.url).searchParams.get("all") === "1"));
  jar.delete(cookieName);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

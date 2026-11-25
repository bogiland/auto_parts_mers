import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { deletePage, movePage, savePage, setPageVisible } from "@/lib/pages-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  if (actor.role !== "owner") return new Response(null, { status: 403 });
  const body = await readJson(request, bodyLimits.gallery).catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  try {
    switch (body.action) {
      case "save-page": return Response.json({ ok: true, id: (await savePage(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "page-visible": (await setPageVisible(actor, String(body.id), body.visible !== false)); break;
      case "move-page": (await movePage(actor, String(body.id), body.direction === "up" ? "up" : "down")); break;
      case "delete-page": (await deletePage(actor, String(body.id))); break;
      default: return new Response(null, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: humanOrFallback(error, "Не удалось сохранить") }, { status: 400 });
  }
}

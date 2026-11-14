import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { deletePage, movePage, savePage, setPageVisible } from "@/lib/pages-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = session((await cookies()).get(cookieName)?.value);
  if (!actor) return new Response(null, { status: 401 });
  if (actor.role !== "owner") return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  try {
    switch (body.action) {
      case "save-page": return Response.json({ ok: true, id: savePage(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "page-visible": setPageVisible(actor, String(body.id), body.visible !== false); break;
      case "move-page": movePage(actor, String(body.id), body.direction === "up" ? "up" : "down"); break;
      case "delete-page": deletePage(actor, String(body.id)); break;
      default: return new Response(null, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Не удалось сохранить" }, { status: 400 });
  }
}

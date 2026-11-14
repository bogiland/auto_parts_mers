import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { deleteBrand, deleteCategory, deletePartType, deleteVehicle, moveCategory, saveBrand, saveCategory, saveGeneration, saveMake, saveModel, savePartType } from "@/lib/reference-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = session((await cookies()).get(cookieName)?.value);
  if (!actor) return new Response(null, { status: 401 });
  if (actor.role !== "owner") return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.action !== "string") return new Response(null, { status: 400 });
  const id = typeof body.id === "string" ? body.id : "";
  try {
    switch (body.action) {
      case "save-category": return Response.json({ ok: true, id: saveCategory(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "move-category": {
        if (!id || !Number.isSafeInteger(body.index) || body.index < 0) return new Response(null, { status: 400 });
        moveCategory(actor, id, typeof body.parentId === "string" && body.parentId ? body.parentId : null, body.index);
        break;
      }
      case "delete-category": {
        if (!id) return new Response(null, { status: 400 });
        deleteCategory(actor, id, typeof body.moveTo === "string" && body.moveTo ? body.moveTo : null);
        break;
      }
      case "save-part-type": return Response.json({ ok: true, id: savePartType(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-part-type": { if (!id) return new Response(null, { status: 400 }); deletePartType(actor, id); break; }
      case "save-make": return Response.json({ ok: true, id: saveMake(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "save-model": return Response.json({ ok: true, id: saveModel(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "save-generation": return Response.json({ ok: true, id: saveGeneration(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-vehicle": {
        if (!id || !["make", "model", "generation"].includes(body.level)) return new Response(null, { status: 400 });
        deleteVehicle(actor, body.level, id);
        break;
      }
      case "save-brand": return Response.json({ ok: true, id: saveBrand(actor, body) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-brand": { if (!id) return new Response(null, { status: 400 }); deleteBrand(actor, id); break; }
      default: return new Response(null, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Не удалось сохранить" }, { status: 400 });
  }
}

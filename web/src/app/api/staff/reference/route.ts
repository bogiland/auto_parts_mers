import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { deleteBrand, deleteCategory, deletePartType, deleteVehicle, moveCategory, saveBrand, saveCategory, saveGeneration, saveMake, saveModel, savePartType } from "@/lib/reference-db";

// Проверки с предикатом: после них тип значения известен и приведения не нужны.
const isIndex = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
type VehicleLevel = "make" | "model" | "generation";
const isLevel = (value: unknown): value is VehicleLevel => value === "make" || value === "model" || value === "generation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  if (actor.role !== "owner") return new Response(null, { status: 403 });
  const body = await readJson(request, bodyLimits.gallery).catch(() => null);
  if (!body || typeof body !== "object" || typeof body.action !== "string") return new Response(null, { status: 400 });
  const id = typeof body.id === "string" ? body.id : "";
  try {
    switch (body.action) {
      case "save-category": return Response.json({ ok: true, id: (await saveCategory(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "move-category": {
        if (!id || !isIndex(body.index)) return new Response(null, { status: 400 });
        (await moveCategory(actor, id, typeof body.parentId === "string" && body.parentId ? body.parentId : null, body.index));
        break;
      }
      case "delete-category": {
        if (!id) return new Response(null, { status: 400 });
        (await deleteCategory(actor, id, typeof body.moveTo === "string" && body.moveTo ? body.moveTo : null));
        break;
      }
      case "save-part-type": return Response.json({ ok: true, id: (await savePartType(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-part-type": { if (!id) return new Response(null, { status: 400 }); (await deletePartType(actor, id)); break; }
      case "save-make": return Response.json({ ok: true, id: (await saveMake(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "save-model": return Response.json({ ok: true, id: (await saveModel(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "save-generation": return Response.json({ ok: true, id: (await saveGeneration(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-vehicle": {
        if (!id || !isLevel(body.level)) return new Response(null, { status: 400 });
        (await deleteVehicle(actor, body.level, id));
        break;
      }
      case "save-brand": return Response.json({ ok: true, id: (await saveBrand(actor, body)) }, { headers: { "Cache-Control": "no-store" } });
      case "delete-brand": { if (!id) return new Response(null, { status: 400 }); (await deleteBrand(actor, id)); break; }
      default: return new Response(null, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: humanOrFallback(error, "Не удалось сохранить") }, { status: 400 });
  }
}

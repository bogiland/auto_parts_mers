import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { addPart, findDuplicate, saveDonor, setPartHidden, setPartPhotos, setPartPrice, updatePart } from "@/lib/parts-db";
import { listStockMoves, sellOffline, undoStockMove } from "@/lib/orders-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const json = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });
  try {
    switch (body.action) {
      case "save-donor": return json({ ok: true, id: (await saveDonor(actor, body)) });
      case "add-part": return json({ ok: true, ...(await addPart(actor, body)) });
      case "update-part": (await updatePart(actor, body)); break;
      case "part-photos": return json({ ok: true, photos: (await setPartPhotos(actor, String(body.id), body.photos)) });
      case "part-hidden": (await setPartHidden(actor, String(body.id), body.hidden !== false)); break;
      case "part-price": (await setPartPrice(actor, String(body.id), Number(body.price))); break;
      case "sell-offline": (await sellOffline(actor, String(body.id))); break;
      case "undo-move": (await undoStockMove(actor, Number(body.id))); break;
      case "stock-moves": return json({ ok: true, moves: (await listStockMoves(typeof body.id === "string" ? body.id : undefined)) });
      case "check-duplicate": return json({ ok: true, duplicate: (await findDuplicate(String(body.donorId ?? ""), String(body.partTypeId ?? ""), String(body.side ?? ""))) });
      default: return new Response(null, { status: 400 });
    }
    return json({ ok: true });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Не удалось сохранить" }, { status: 400 });
  }
}

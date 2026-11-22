import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { addStaffInquiry, addUser, changeRole, findPeople, grantStaffAccess, importInventory, removeUser, revealInquiryPhone, revealPhone, session, setCost, setInquiryStatus, setInventory, updateSettings, type Role } from "@/lib/staff-db";
import { addPart, setPartPhotos } from "@/lib/parts-db";
import { currentStock, recordStockDiff } from "@/lib/orders-db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  try {
    if (body.action === "reveal" && Number.isSafeInteger(body.id)) {
      const phone = (await revealPhone(actor, body.id));
      return phone ? Response.json({ phone }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
    }
    if (body.action === "reveal-inquiry" && Number.isSafeInteger(body.id)) {
      const phone = (await revealInquiryPhone(actor, body.id));
      return phone ? Response.json({ phone }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
    }
    if (body.action === "find-people" && actor.role === "owner" && typeof body.query === "string") {
      return Response.json({ people: (await findPeople(body.query)) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "inquiry-status" && Number.isSafeInteger(body.id) && typeof body.status === "string") (await setInquiryStatus(actor, body.id, body.status));
    else if (body.action === "inventory" && typeof body.id === "string") {
      // Любая правка остатка попадает в историю движений: что, насколько, почему, кто и когда.
      const before = (await currentStock(body.id));
      (await setInventory(actor, body.id, body.price, body.stock, typeof body.categoryId === "string" ? body.categoryId || null : undefined));
      (await recordStockDiff(actor, body.id, before, body.stock));
    } else if (body.action === "add-product") (await addPart(actor, { ...body, condition: typeof body.condition === "string" && body.condition ? body.condition : "good" }));
    else if (body.action === "photos" && typeof body.id === "string") (await setPartPhotos(actor, body.id, body.photos));
    else if (body.action === "add-inquiry") (await addStaffInquiry(actor, body));
    else if (body.action === "import" && typeof body.csv === "string" && body.csv.length <= 20_000) (await importInventory(actor, body.csv));
    else if (body.action === "cost" && actor.role === "owner" && typeof body.id === "string") (await setCost(actor, body.id, body.cost));
    else if (body.action === "settings" && actor.role === "owner") (await updateSettings(actor, body));
    else if (body.action === "add-user" && actor.role === "owner" && typeof body.name === "string" && body.name.trim().length >= 2 && typeof body.phone === "string" && /^\+\d{8,15}$/.test(body.phone.replace(/[\s()\-]/g, "")) && typeof body.password === "string" && body.password.length >= 12 && ["owner", "operator"].includes(body.role)) (await addUser(actor, body.name, body.phone, body.password, body.role as Role));
    else if (body.action === "role" && actor.role === "owner" && Number.isSafeInteger(body.id) && ["owner", "operator"].includes(body.role)) (await changeRole(actor, body.id, body.role as Role));
    else if (body.action === "delete-user" && actor.role === "owner" && Number.isSafeInteger(body.id)) (await removeUser(actor, body.id));
    else if (body.action === "grant-staff" && actor.role === "owner" && Number.isSafeInteger(body.customerId) && ["owner", "operator"].includes(body.role)) (await grantStaffAccess(actor, body.customerId, body.role as Role));
    else return new Response(null, { status: actor.role === "owner" ? 400 : 403 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Не удалось сохранить" }, { status: 400 });
  }
}

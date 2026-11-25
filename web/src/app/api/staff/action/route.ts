import { cookies } from "next/headers";
import { cookieName } from "@/lib/staff-auth";
import { addStaffInquiry, addUser, changeRole, confirmedActions, findPeople, grantStaffAccess, consumeConfirmation, importInventory, removeUser, revealInquiryPhone, revealPhone, session, setCost, setInquiryStatus, setInventory, updateSettings, type Role } from "@/lib/staff-db";
import { addPart, setPartPhotos } from "@/lib/parts-db";
import { currentStock, recordStockDiff } from "@/lib/orders-db";
import { BodyTooLarge, bodyLimits, humanOrFallback, logFailure, readJson, sameOriginRequest } from "@/lib/http";

// Проверки с предикатом: после них TypeScript знает тип значения, и приведения не нужны.
const isInt = (value: unknown): value is number => Number.isSafeInteger(value);
const isRole = (value: unknown): value is Role => value === "owner" || value === "operator";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  // Предел на размер тела стоит до разбора JSON: в этом маршруте приходят и фотографии.
  let body: Record<string, unknown>;
  try { body = await readJson(request, bodyLimits.gallery); }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return new Response(null, { status: 400 });
  }
  // Смена ролей и выдача доступа требуют заново введённого пароля: живой куки мало.
  if (confirmedActions.has(String(body.action)) && !(await consumeConfirmation(actor, String(body.action)))) {
    return Response.json({ message: "Подтвердите действие паролем.", needConfirm: String(body.action) }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    if (body.action === "reveal" && isInt(body.id)) {
      const phone = (await revealPhone(actor, body.id));
      return phone ? Response.json({ phone }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
    }
    if (body.action === "reveal-inquiry" && isInt(body.id)) {
      const phone = (await revealInquiryPhone(actor, body.id));
      return phone ? Response.json({ phone }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
    }
    if (body.action === "find-people" && actor.role === "owner" && typeof body.query === "string") {
      return Response.json({ people: (await findPeople(body.query)) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "inquiry-status" && isInt(body.id) && typeof body.status === "string") (await setInquiryStatus(actor, body.id, body.status));
    else if (body.action === "inventory" && typeof body.id === "string") {
      // Любая правка остатка попадает в историю движений: что, насколько, почему, кто и когда.
      const before = (await currentStock(body.id));
      (await setInventory(actor, body.id, Number(body.price), Number(body.stock), typeof body.categoryId === "string" ? body.categoryId || null : undefined));
      (await recordStockDiff(actor, body.id, before, Number(body.stock)));
    } else if (body.action === "add-product") (await addPart(actor, { ...body, condition: typeof body.condition === "string" && body.condition ? body.condition : "good" }));
    else if (body.action === "photos" && typeof body.id === "string") (await setPartPhotos(actor, body.id, body.photos));
    else if (body.action === "add-inquiry") (await addStaffInquiry(actor, body));
    else if (body.action === "import" && typeof body.csv === "string" && body.csv.length <= 20_000) (await importInventory(actor, body.csv));
    else if (body.action === "cost" && actor.role === "owner" && typeof body.id === "string") (await setCost(actor, body.id, Number(body.cost)));
    else if (body.action === "settings" && actor.role === "owner") (await updateSettings(actor, body));
    else if (body.action === "add-user" && actor.role === "owner" && typeof body.name === "string" && body.name.trim().length >= 2 && typeof body.phone === "string" && /^\+\d{8,15}$/.test(body.phone.replace(/[\s()\-]/g, "")) && typeof body.password === "string" && body.password.length >= 12 && isRole(body.role)) (await addUser(actor, body.name, body.phone, body.password, body.role));
    else if (body.action === "role" && actor.role === "owner" && isInt(body.id) && isRole(body.role)) (await changeRole(actor, body.id, body.role));
    else if (body.action === "delete-user" && actor.role === "owner" && isInt(body.id)) (await removeUser(actor, body.id));
    else if (body.action === "grant-staff" && actor.role === "owner" && isInt(body.customerId) && isRole(body.role)) (await grantStaffAccess(actor, body.customerId, body.role));
    else return new Response(null, { status: actor.role === "owner" ? 400 : 403 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Наши проверки пишут по-русски и предназначены человеку; текст ошибки базы
    // раскрывает имена таблиц и колонок, поэтому наружу он не уходит.
    const message = humanOrFallback(error, "Не удалось сохранить");
    if (message === "Не удалось сохранить") logFailure("Действие в админке", error, { action: body.action, actor: actor.id });
    return Response.json({ message }, { status: 400 });
  }
}

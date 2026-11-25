import { bodyFailure, bodyLimits, humanOrFallback, readJson } from "@/lib/http";
import { cookies } from "next/headers";
import { cookieName, sameOrigin } from "@/lib/staff-auth";
import { revealPhone, session } from "@/lib/staff-db";
import {
  buildReceipt, changeStatus, clientByPhone, createCallOrder, createReturn, messageTemplates, orderDetail,
  returnsOfOrder, revokeReceipt, searchParts, setAgainstAdvice, setDeliveryCost, setDeliveryMethod, setFiscalNumber,
  setIssuePhotos, setOrderNotes, setPaymentMethod,
} from "@/lib/orders-db";
import { getSettings } from "@/lib/checkout-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const actor = (await session((await cookies()).get(cookieName)?.value));
  if (!actor) return new Response(null, { status: 401 });
  const body = await readJson(request, bodyLimits.gallery).catch(() => null);
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const json = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });
  const id = () => {
    if (!Number.isSafeInteger(body.id)) throw new Error("Заказ не найден.");
    return Number(body.id);
  };
  try {
    switch (body.action) {
      case "order-status": (await changeStatus(actor, id(), String(body.status), body.version, typeof body.comment === "string" ? body.comment : "")); break;
      case "delivery-cost": (await setDeliveryCost(actor, id(), body.cost, body.version)); break;
      case "order-notes": (await setOrderNotes(actor, id(), body.notes, body.version)); break;
      case "against-advice": (await setAgainstAdvice(actor, id(), body.value === true, body.version)); break;
      case "issue-photos": return json({ ok: true, photos: (await setIssuePhotos(actor, id(), body.photos, body.version)) });
      case "receipt": {
        const result = (await buildReceipt(actor, id(), body.version, new URL(request.url).origin));
        return json({ ok: true, ...result, url: `/receipt/${result.token}` });
      }
      case "fiscal-number": (await setFiscalNumber(actor, id(), body.value, body.version)); break;
      case "receipt-revoke": (await revokeReceipt(actor, id(), body.version)); break;
      case "delivery-method": (await setDeliveryMethod(actor, id(), body.method, body.address, body.version)); break;
      case "payment-method": (await setPaymentMethod(actor, id(), body.method, body.version)); break;
      case "order-detail": {
        const order = (await orderDetail(id()));
        if (!order) throw new Error("Заказ не найден.");
        // В обычном ответе телефона нет — только маска. Полный номер отдаётся
        // отдельным действием «order-phone», и каждый такой показ попадает в журнал.
        const { phone: _hidden, ...safe } = order;
        return json({ ok: true, order: safe, returns: (await returnsOfOrder(order.id)), message: messageTemplates(order, (await getSettings())) });
      }
      case "create-return": (await createReturn(actor, body)); break;
      case "create-call-order": return json({ ok: true, ...(await createCallOrder(actor, body)) });
      case "client-lookup": return json({ ok: true, client: (await clientByPhone(String(body.phone ?? ""))) });
      case "search-parts": return json({ ok: true, parts: (await searchParts(String(body.query ?? ""))) });
      case "order-message": {
        const order = (await orderDetail(id()));
        if (!order) throw new Error("Заказ не найден.");
        return json({ ok: true, ...messageTemplates(order, (await getSettings())) });
      }
      case "order-phone": {
        const phone = (await revealPhone(actor, id()));
        return phone ? json({ ok: true, phone }) : new Response(null, { status: 404 });
      }
      default: return new Response(null, { status: 400 });
    }
    return json({ ok: true });
  } catch (error) {
    return Response.json({ message: humanOrFallback(error, "Не удалось сохранить") }, { status: 400 });
  }
}

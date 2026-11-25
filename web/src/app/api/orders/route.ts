import { isValidPhoneNumber } from "libphonenumber-js";
import { createOrder, OrderError, orderExistsForOwner, type OrderInput } from "@/lib/checkout-db";
import { currentCustomer } from "@/lib/customer-auth";
import { guestCookieHeader, readGuestId } from "@/lib/guest-session";
import { BodyTooLarge, bodyLimits, clientIp, logFailure, readJson, sameOriginRequest } from "@/lib/http";
import { allow, tooMany, windows } from "@/lib/rate-limit";
import { toInternational } from "@/lib/staff-db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Оформление с чужой страницы не принимается: форма живёт только у нас.
  if (!sameOriginRequest(request)) return new Response(null, { status: 403 });

  // Тело читается с ограничением по байтам: отказ наступает до разбора JSON,
  // поэтому стомегабайтный запрос не занимает ни память, ни процессор.
  let input: OrderInput;
  try { input = (await readJson(request, bodyLimits.form)) as unknown as OrderInput; }
  catch (error) {
    if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
    return Response.json({ field: "items", message: "Не удалось прочитать заказ." }, { status: 400 });
  }

  const invalid = (field: string, message: string) => Response.json({ field, message }, { status: 400 });
  if (typeof input.key !== "string" || !/^[a-f0-9-]{36}$/i.test(input.key)) return invalid("items", "Обновите страницу и повторите.");
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.length > 100) return invalid("name", "Укажите имя.");
  if (typeof input.phone !== "string" || !isValidPhoneNumber(input.phone)) return invalid("phone", "Проверьте номер телефона.");
  if (!["call", "viber", "telegram"].includes(input.contactMethod)) return invalid("contactMethod", "Выберите способ связи.");
  if (typeof input.address !== "string" || input.address.length > 500) return invalid("address", "Проверьте адрес.");
  if (typeof input.comment !== "string" || input.comment.length > 2000) return invalid("comment", "Комментарий слишком длинный.");
  if (!Array.isArray(input.items)) return invalid("items", "Проверьте состав корзины.");

  // Владелец заказа известен до вставки: вошедший покупатель — по кабинету,
  // гость — по куке браузера. Привязка происходит в той же транзакции, что и создание,
  // поэтому чужой заказ в кабинет попасть не может.
  const customer = await currentCustomer();
  const { guestId, fresh } = await readGuestId();
  const owner = { customerId: customer?.id ?? null, guestId };

  // Два независимых предела. По адресу — чтобы бот не завалил нас потоком заказов;
  // по номеру — чтобы тот же бот через разные адреса не засыпал один номер.
  // Проверяются раздельно: заказ с другого адреса проходит, даже когда первый адрес исчерпан.
  //
  // Повтор уже созданного заказа пределы не трогает: человек, у которого трижды
  // оборвалась связь, шлёт ту же форму с тем же ключом — это одна попытка, а не три,
  // и отказ «слишком много запросов» отнял бы у него собственный заказ (гарантия П1).
  const ip = clientIp(request);
  const repeat = await orderExistsForOwner(input.key, owner);
  if (!repeat) {
    if (!(await allow("checkout:ip", ip, windows.checkoutIp))) return tooMany();
    if (!(await allow("checkout:phone", toInternational(input.phone) || input.phone, windows.checkoutPhone))) return tooMany();
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (!customer && fresh) headers["Set-Cookie"] = guestCookieHeader(guestId);
  try {
    const order = (await createOrder(input, owner));
    return Response.json(order, { status: 201, headers });
  }
  catch (error) {
    if (error instanceof OrderError) return Response.json({ field: error.field, message: error.message }, { status: error.status, headers });
    // Ни телефона, ни токена статуса в журнале: ошибку находят по коду из ответа.
    const reference = logFailure("Создание заказа", error, { ip });
    return Response.json({ field: "submit", message: "Не удалось отправить заказ. Повторите попытку.", reference }, { status: 500, headers });
  }
}

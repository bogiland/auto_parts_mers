import "server-only";

import { cookies } from "next/headers";
import { guestCookie, guestCookieMaxAge, guestIdShape, newGuestId } from "@/lib/guest-cookie";

/**
 * Гостевая сессия оформления. Нужна только для того, чтобы ключ идемпотентности
 * заказа действовал в пределах одного браузера: повтор после обрыва сети находит
 * свой заказ, а чужой ключ не выдаёт ни заказ, ни его токен.
 * Никаких персональных данных внутри нет — только случайный идентификатор.
 * Куку выдаёт proxy.ts заранее, ещё до оформления, поэтому обрыв ответа
 * на сам заказ не лишает покупателя его сессии.
 */
export { guestCookie, guestCookieMaxAge, newGuestId };

/** Идентификатор из куки или новый. Второе значение — нужно ли выставить куку в ответе. */
export async function readGuestId(): Promise<{ guestId: string; fresh: boolean }> {
  const stored = (await cookies()).get(guestCookie)?.value;
  if (stored && guestIdShape.test(stored)) return { guestId: stored, fresh: false };
  return { guestId: newGuestId(), fresh: true };
}

export function guestCookieHeader(guestId: string) {
  const parts = [
    `${guestCookie}=${guestId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${guestCookieMaxAge}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

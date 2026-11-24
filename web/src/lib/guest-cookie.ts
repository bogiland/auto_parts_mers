/**
 * Имя и формат гостевой куки оформления. Лежит отдельно от серверных помощников,
 * потому что эту же куку выставляет proxy.ts — он работает до рендера и
 * server-only модули ему не доступны.
 */
export const guestCookie = "naa_guest";
export const guestCookieMaxAge = 30 * 24 * 60 * 60;
export const guestIdShape = /^[a-f0-9]{32}$/i;

export function newGuestId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guestCookie, guestCookieMaxAge, guestIdShape, newGuestId } from "@/lib/guest-cookie";

/**
 * Гостевая сессия выдаётся при обычном заходе на сайт, до оформления заказа.
 * Так повтор после обрыва связи попадает в ту же область, что и первая попытка,
 * и покупатель получает свой заказ, а не отказ. Внутри куки только случайный
 * идентификатор: ни телефона, ни имени, ни адреса.
 */
/** Страницы с персональными данными: их нельзя класть ни в какой кэш. */
const privatePath = /^\/(receipt|account|order\/s|ad-report)(\/|$)/;

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (privatePath.test(request.nextUrl.pathname)) {
    // Заголовок из next.config для динамической страницы перебивается самим Next,
    // поэтому ставим его здесь — после рендера он уже не меняется.
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  const stored = request.cookies.get(guestCookie)?.value;
  if (!stored || !guestIdShape.test(stored)) {
    response.cookies.set({
      name: guestCookie,
      value: newGuestId(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: guestCookieMaxAge,
    });
  }
  return response;
}

export const config = {
  // Только обычные страницы: статика, изображения и служебные файлы не трогаются.
  matcher: ["/((?!_next/static|_next/image|uploads|images|demo|favicon.ico|robots.txt|sitemap.xml).*)"],
};

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

/**
 * Правила содержимого.
 *
 * frame-ancestors запрещает открывать наши страницы в чужом окне — без него
 * поверх кнопки «Оформить» или «Сменить роль» кладут прозрачный слой и нажимают
 * её чужими руками. form-action закрывает отправку наших форм на сторону.
 *
 * script-src оставлен с 'unsafe-inline': Next кладёт на страницу встроенные
 * скрипты, и без разрешения сайт перестаёт работать целиком. Чтобы убрать это
 * послабление, нужен одноразовый код на каждый запрос (nonce) — отдельная работа,
 * в этот пункт она не входит. Поэтому правило пока ограничивает источники,
 * но не защищает от встроенного скрипта.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
].join("; ");

/**
 * Самый большой запрос, который вообще имеет смысл принимать: карточка детали
 * с десятью фотографиями. Проверка стоит здесь, до маршрута, чтобы заведомо
 * неподъёмный запрос получал отказ как можно раньше.
 */
const maxBodyBytes = 12_000_000;

export function proxy(request: NextRequest) {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    return new NextResponse(null, { status: 413, headers: { "Cache-Control": "no-store", Connection: "close" } });
  }

  const response = NextResponse.next();

  // Общие заголовки для всех страниц и запросов.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // HSTS только там, где сайт действительно открыт по HTTPS: на локальной машине
  // этот заголовок заставит браузер месяцами отказываться открывать http://localhost.
  const https = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  if (https && process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

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

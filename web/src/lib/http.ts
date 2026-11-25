import "server-only";

/**
 * Общие правила для всех маршрутов: сколько байт читать, что отвечать при ошибке
 * и что можно писать в журнал. Раньше каждый маршрут решал это сам, поэтому
 * где-то не было ограничения размера, а где-то наружу уходил текст исключения.
 */

/** Адрес обращающегося. За обратным прокси настоящий адрес приходит заголовком. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "local";
}

/** Запрос с чужой страницы на публичные формы не принимается. */
export function sameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export class BodyTooLarge extends Error {
  constructor() { super("body too large"); this.name = "BodyTooLarge"; }
}
export class BodyUnreadable extends Error {
  constructor() { super("body unreadable"); this.name = "BodyUnreadable"; }
}

/**
 * Читает тело по кускам и обрывает соединение, как только превышен предел.
 * Content-Length проверяется первым, но доверять ему нельзя: заголовок подделывается,
 * а при chunked его просто нет — поэтому считаем и фактические байты.
 */
export async function readBody(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new BodyUnreadable();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new BodyTooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

/** Тело как объект. Массив и примитив отбрасываются: все наши запросы — объекты. */
export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const text = await readBody(request, maxBytes);
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new BodyUnreadable(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new BodyUnreadable();
  return parsed as Record<string, unknown>;
}

/** Предельные размеры тела по видам запросов. Фото приходят в base64, поэтому больше. */
export const bodyLimits = {
  /** Обычная форма: имя, телефон, адрес, состав корзины. */
  form: 64_000,
  /** Действие в админке без картинок. */
  action: 256_000,
  /** Запрос с одной фотографией. */
  photo: 3_000_000,
  /** Карточка детали с несколькими фотографиями. */
  gallery: 12_000_000,
} as const;

/* ---------- Текст наружу и текст в журнал ---------- */

const phoneShape = /\+?\d[\d\s()-]{6,}\d/g;
const tokenShape = /\b[a-f0-9]{24,}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Телефон в журнале: видны код страны и две последние цифры. */
export function maskPhone(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `+${digits.slice(0, 3)} ** ***${digits.slice(-2)}`;
}

/** Любая строка перед записью в журнал: телефоны и токены вырезаются. */
export function safeForLog(value: unknown): string {
  return String(value ?? "")
    .replace(phoneShape, (match) => maskPhone(match))
    .replace(tokenShape, "***")
    .slice(0, 500);
}

/**
 * Запись об ошибке. Наружу уходит только код, по нему ошибку находят в журнале;
 * текста исключения, пути файла и стека в ответе нет.
 */
export function logFailure(where: string, error: unknown, context: Record<string, unknown> = {}): string {
  const reference = Math.random().toString(36).slice(2, 10);
  const parts = Object.entries(context).map(([key, value]) => `${key}=${safeForLog(value)}`);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${reference}] ${where}: ${safeForLog(message)}${parts.length ? ` (${parts.join(" ")})` : ""}`);
  return reference;
}

/** Ответ об ошибке сервера: безопасный текст плюс код для обращения в поддержку. */
export function serverError(where: string, error: unknown, context: Record<string, unknown> = {}): Response {
  const reference = logFailure(where, error, context);
  return Response.json(
    { message: "Не удалось выполнить запрос. Повторите попытку.", reference },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Текст ошибки, который можно показать человеку. Наши собственные проверки бросают
 * понятные сообщения, но в тот же catch попадают и ошибки драйвера базы — их текст
 * раскрывает имена таблиц и колонок. Поэтому наружу идёт только то, что внесено в список.
 */
export function visibleMessage(error: unknown, allowed: readonly string[], fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return allowed.includes(message) ? message : fallback;
}

/**
 * Ошибки проверок в справочниках и карточках пишутся по-русски и предназначены человеку,
 * в отличие от ошибок драйвера базы — те всегда по-английски и содержат служебные имена.
 * Сообщение показывается, только если оно целиком из русских букв и знаков препинания.
 */
const humanMessage = /^[А-Яа-яЁё0-9 ,.:;!?«»"'()\/№–—-]{4,200}$/;

export function humanOrFallback(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return humanMessage.test(message) ? message : fallback;
}

/**
 * Ответ на непрочитанное тело: слишком большое — 413, неразборчивое — 400.
 * Возвращает null, если ошибка не про тело, и тогда её разбирает вызывающий.
 */
export function bodyFailure(error: unknown): Response | null {
  if (error instanceof BodyTooLarge) return new Response(null, { status: 413 });
  if (error instanceof BodyUnreadable) return new Response(null, { status: 400 });
  return null;
}

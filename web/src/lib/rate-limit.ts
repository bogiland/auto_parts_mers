import "server-only";

import { createHash } from "node:crypto";
import { inTx, run, txBound } from "@/lib/db";

/**
 * Счётчик обращений, общий для всех маршрутов.
 *
 * Хранится в базе, а не в памяти процесса: при нескольких рабочих процессах
 * память у каждого своя, и лимит в 10 превращается в 10 на процесс. База одна.
 *
 * Проверка и запись идут под блокировкой по самому ключу (`pg_advisory_xact_lock`),
 * поэтому двадцать одновременных запросов не могут все вместе увидеть «ещё можно»:
 * они встают в очередь по одному. Блокировка берётся по хешу ключа, а не по таблице,
 * поэтому разные IP друг друга не задерживают.
 */

export type Window = { limit: number; windowMs: number };

/** Готовые наборы: собраны в одном месте, чтобы пределы было видно целиком. */
export const windows = {
  /** Оформление заказа с одного адреса. */
  checkoutIp: { limit: 30, windowMs: 60_000 },
  /** Оформление заказа на один номер телефона. */
  checkoutPhone: { limit: 5, windowMs: 60_000 },
  /** Отклик на вакансию с одного адреса. */
  applyIp: { limit: 10, windowMs: 60_000 },
  /** Отклик на вакансию с одного номера. */
  applyPhone: { limit: 3, windowMs: 60_000 },
  /** Заявка эксперту с одного адреса. */
  inquiryIp: { limit: 20, windowMs: 60_000 },
  /** Вход сотрудника с одного адреса: подбор пароля идёт именно так. */
  staffLoginIp: { limit: 20, windowMs: 60_000 },
  /** Вход сотрудника на один номер. */
  staffLoginPhone: { limit: 5, windowMs: 60_000 },
  /** Вход покупателя с одного адреса. */
  customerLoginIp: { limit: 20, windowMs: 60_000 },
  /** Просмотр статуса заказа по ссылке: перебор токенов идёт отсюда. */
  orderStatusIp: { limit: 60, windowMs: 60_000 },
  /** Повторный ввод пароля перед опасным действием. */
  confirmIp: { limit: 10, windowMs: 60_000 },
} as const satisfies Record<string, Window>;

/** 64-битный ключ блокировки из строки: pg_advisory_lock принимает только число. */
function lockKey(bucket: string, key: string): bigint {
  const digest = createHash("sha256").update(`${bucket}\u0000${key}`).digest();
  return digest.readBigInt64BE(0);
}

/** Раз в несколько минут подчищаем всё просроченное, чтобы таблица не росла. */
let sweptAt = 0;
async function sweep(now: number) {
  if (now - sweptAt < 5 * 60_000) return;
  sweptAt = now;
  await run("DELETE FROM rate_hits WHERE at < $1", [now - 24 * 60 * 60_000]).catch(() => {});
}

/**
 * Отмечает обращение и говорит, можно ли его обслуживать.
 * Возвращает `false`, когда предел уже исчерпан; в этом случае обращение не записывается,
 * поэтому отказ не продлевает блокировку сам себя.
 */
export async function allow(bucket: string, key: string, window: Window, now = Date.now()): Promise<boolean> {
  const trimmed = String(key ?? "").slice(0, 128) || "unknown";
  await sweep(now);
  return await txBound(async (client) => {
    await inTx.run(client, "SELECT pg_advisory_xact_lock($1)", [lockKey(bucket, trimmed)]);
    await inTx.run(client, "DELETE FROM rate_hits WHERE bucket = $1 AND key = $2 AND at < $3",
      [bucket, trimmed, now - window.windowMs]);
    const row = await inTx.one<{ used: string }>(client,
      "SELECT COUNT(*) AS used FROM rate_hits WHERE bucket = $1 AND key = $2", [bucket, trimmed]);
    if (Number(row?.used ?? 0) >= window.limit) return false;
    await inTx.run(client, "INSERT INTO rate_hits (bucket, key, at) VALUES ($1,$2,$3)", [bucket, trimmed, now]);
    return true;
  });
}

/**
 * Несколько пределов разом: по адресу и по номеру телефона.
 * Проверяются по очереди и независимо — бот с одного адреса не блокирует
 * чужой номер, а один номер с разных адресов всё равно ограничен.
 */
export async function allowAll(checks: { bucket: string; key: string; window: Window }[]): Promise<boolean> {
  for (const check of checks) {
    if (!(await allow(check.bucket, check.key, check.window))) return false;
  }
  return true;
}

/** Стандартный ответ при превышении. Повтор через минуту — окна у нас минутные. */
export function tooMany(): Response {
  return Response.json(
    { message: "Слишком много запросов. Повторите через минуту." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
  );
}

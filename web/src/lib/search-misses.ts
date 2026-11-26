import "server-only";

import { many, run } from "@/lib/db";

/**
 * Журнал поисков без результата: список того, что ищут и чего нет на сайте.
 * Он же — семантика для SEO: под частые запросы стоит завести детали или страницы.
 *
 * Персональных данных здесь нет. Если человек вбил в поиск телефон или почту,
 * они заменяются меткой до записи.
 */
export function scrubQuery(value: string) {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[почта]")
    .replace(/\+\s?\d[\d\s()-]{6,}\d/g, "[телефон]")
    // Местный номер без кода: 0 или 6/7 и ещё 7–8 цифр, отдельным словом. Номера деталей обычно с буквами.
    .replace(/(^|\s)0?[67]\d{7}(?=\s|$)/g, "$1[телефон]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function recordSearchMiss(query: string, car: string) {
  const clean = scrubQuery(query);
  if (clean.length < 2) return;
  await run("INSERT INTO search_misses (query, vehicle) VALUES ($1, $2)", [clean, car.slice(0, 120)]);
}

export type SearchMiss = { query: string; vehicle: string; hits: number; last_at: string };

/** Сводка: одинаковые запросы по одной машине склеены, сверху — свежие и частые. */
export async function listSearchMisses(limit = 100) {
  return many<SearchMiss>(
    `SELECT min(query) AS query, vehicle, COUNT(*)::int AS hits, max(requested_at)::text AS last_at
     FROM search_misses
     GROUP BY lower(regexp_replace(query, '[^[:alnum:]]', '', 'g')), vehicle
     ORDER BY max(requested_at) DESC LIMIT $1`, [limit]);
}

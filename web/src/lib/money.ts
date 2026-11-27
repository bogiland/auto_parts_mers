/**
 * Деньги на сайте (П8). Основная и единственная валюта русской версии — рубль ПМР.
 * Колонки *_mdl в базе после перевода (scripts/migrate-currency-rub.mjs) хранят рубли ПМР:
 * имена оставлены, чтобы не ломать старые записи и выгрузки. Леи появятся только на румынской версии
 * пересчётом по курсу из настроек (settings.rates.mdl).
 */
export function formatRub(value: number | null | undefined): string {
  return `${Math.round(Number(value ?? 0)).toLocaleString("ru-RU")} руб.`;
}

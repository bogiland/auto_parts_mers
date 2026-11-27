/**
 * Часы и контакты магазина — один источник для шапки, футера, контактов и страницы заказа.
 * Значения из «Ответов владельца» (ПРОЕКТ.md, раздел «Часы работы»).
 */
export const storeHours = {
  warehouse: "пн–пт 9–18, сб 9–14, вс выходной",
  calls: "пн–пт 8–20, сб 9–14",
  /** Полная строка — в футере, на контактах и в заказе. */
  full: "Склад: пн–пт 9–18, сб 9–14, вс выходной · Звонки: пн–пт 8–20, сб 9–14 · Писать можно в любое время",
  /** Коротко — в шапке. */
  short: "Звонки пн–пт 8–20, сб 9–14",
};

/** Viber и Telegram — один номер, чат открывается сразу. */
export const messenger = {
  phone: "+37377745636",
  label: "+373 777 45 636",
  viber: "viber://chat?number=%2B37377745636",
  telegram: "https://t.me/+37377745636",
};

export const languagesLine = "Говорим на русском и румынском";

/** Ссылка на карту по адресу самовывоза. */
export function mapUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

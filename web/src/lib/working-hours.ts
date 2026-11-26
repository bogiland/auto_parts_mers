/**
 * Когда оператор ответит. Писать можно в любое время, а отвечает оператор с 8:00 до 20:00
 * по времени Молдовы (docs/product-context.md). Заявка, пришедшая ночью, получает честное
 * «Ответим с 8:00», а не обещание перезвонить сейчас.
 */
export const operatorOpens = 8;
export const operatorCloses = 20;

/** Час по Кишинёву: сервер может стоять в другом часовом поясе. */
export function chisinauHour(date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Chisinau" }).format(date));
}

export function isAfterHours(date: Date = new Date()) {
  const hour = chisinauHour(date);
  return hour >= operatorCloses || hour < operatorOpens;
}

export function replyPromise(afterHours: boolean) {
  return afterHours
    ? "Сейчас нерабочее время. Ответим с 8:00."
    : "Оператор свяжется с вами в рабочее время, с 8:00 до 20:00.";
}

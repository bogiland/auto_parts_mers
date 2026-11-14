export async function staffCall<T = Record<string, unknown>>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/staff/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Не удалось сохранить. Попробуйте снова.");
  return (await response.json().catch(() => ({}))) as T;
}

export const money = (value: number) => `${Number(value ?? 0).toLocaleString("ru-RU")} L.`;

export const when = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

/** «ждёт 42 мин» — так видно заказ, который висит в «Новых» дольше получаса. */
export function waitingLabel(minutes: number) {
  if (minutes < 60) return `ждёт ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ждёт ${hours} ч ${minutes % 60} мин`;
  return `ждёт ${Math.floor(hours / 24)} сут`;
}

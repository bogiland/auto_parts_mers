/** Общая часть выбранной машины: тип и запись в куку. Используется и сервером, и браузером. */
export type SelectedCar = {
  /** Адрес машины: марка/модель/кузов. */
  slug: string;
  /** Полное название: «Mercedes-Benz E-класс W212». */
  label: string;
  /** Короткая плашка: «W212 2013». */
  short: string;
  year: string;
  donorIds: string[];
};

export const carCookie = "naa_car";

/** Запоминает машину в браузере на полгода. Пустой slug — забыть. */
export function rememberCar(car: { slug: string; label: string } | null) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  if (!car) { document.cookie = `${carCookie}=; path=/; max-age=0; samesite=lax${secure}`; return; }
  const value = encodeURIComponent(JSON.stringify({ slug: car.slug, label: car.label }));
  document.cookie = `${carCookie}=${value}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax${secure}`;
}

/** Машина из куки в браузере — для подстановки в формы заявок. */
export function storedCarLabel(): string {
  if (typeof document === "undefined") return "";
  const raw = document.cookie.split("; ").find((item) => item.startsWith(`${carCookie}=`))?.slice(carCookie.length + 1);
  if (!raw) return "";
  try { return String((JSON.parse(decodeURIComponent(raw)) as { label?: unknown }).label ?? "").slice(0, 120); } catch { return ""; }
}

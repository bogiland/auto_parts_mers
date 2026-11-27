/**
 * Фото детали. src — оригинал, preview — 400 px для списков, thumb — 96 px для ленты галереи.
 * closeup — крупный план номера или дефекта.
 */
export type Photo = { src: string; closeup: boolean; preview?: string; thumb?: string };

/**
 * Демонабор ссылается на условные картинки /demo/*.svg. Раньше они подменялись одной
 * стоковой ступицей, и у КПП, фары, двери и колодок на карточке стояло одно и то же чужое фото.
 * На б/у детали можно показывать только её собственные фото, поэтому такие ссылки
 * считаются отсутствием фото: карточка покажет заглушку «Фото пришлём в Viber».
 */
const notAPhoto = (src: string) => /^\/demo\/[a-z-]+\.svg$/.test(src) || src === "/images/products/neutral-placeholder.png";

// Читается и на сервере, и в браузере: в базе лежат как старые строки, так и новые объекты с отметкой «крупный план».
export function parsePhotos(value: unknown): Photo[] {
  let raw: unknown = value;
  if (typeof value === "string") { try { raw = JSON.parse(value || "[]"); } catch { return []; } }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string"
      ? { src: item, closeup: false, preview: "", thumb: "" }
      : { src: String((item as Photo)?.src ?? ""), closeup: Boolean((item as Photo)?.closeup), preview: String((item as Photo)?.preview ?? ""), thumb: String((item as Photo)?.thumb ?? "") }))
    .filter((item) => item.src && !notAPhoto(item.src))
    .map((item) => ({ ...item, preview: item.preview && !notAPhoto(item.preview) ? item.preview : "", thumb: item.thumb && !notAPhoto(item.thumb) ? item.thumb : "" }));
}

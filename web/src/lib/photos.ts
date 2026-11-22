export type Photo = { src: string; closeup: boolean; preview?: string };
const displaySource = (src: string) => /^\/demo\/(wide|square|portrait|tall|large|donor)\.svg$/.test(src) ? "/images/products/neutral-placeholder.png" : src;

// Читается и на сервере, и в браузере: в базе лежат как старые строки, так и новые объекты с отметкой «крупный план».
export function parsePhotos(value: unknown): Photo[] {
  let raw: unknown = value;
  if (typeof value === "string") { try { raw = JSON.parse(value || "[]"); } catch { return []; } }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string"
      ? { src: item, closeup: false, preview: "" }
      : { src: String((item as Photo)?.src ?? ""), closeup: Boolean((item as Photo)?.closeup), preview: String((item as Photo)?.preview ?? "") }))
    .filter((item) => item.src)
    .map(item => ({ ...item, src: displaySource(item.src), preview: item.preview ? displaySource(item.preview) : "" }));
}

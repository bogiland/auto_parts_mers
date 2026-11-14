export type Photo = { src: string; closeup: boolean; preview?: string };

// Читается и на сервере, и в браузере: в базе лежат как старые строки, так и новые объекты с отметкой «крупный план».
export function parsePhotos(value: unknown): Photo[] {
  let raw: unknown = value;
  if (typeof value === "string") { try { raw = JSON.parse(value || "[]"); } catch { return []; } }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string"
      ? { src: item, closeup: false, preview: "" }
      : { src: String((item as Photo)?.src ?? ""), closeup: Boolean((item as Photo)?.closeup), preview: String((item as Photo)?.preview ?? "") }))
    .filter((item) => item.src);
}

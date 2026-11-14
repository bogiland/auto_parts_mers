export type ImagePreset = { label: string; short: string; width: number; height: number; note?: string };

const presets = {
  "banner-desktop": { label: "Баннер на главной, компьютер", short: "Компьютер", width: 1320, height: 560 },
  "banner-tablet": { label: "Баннер на главной, планшет", short: "Планшет", width: 1152, height: 480 },
  "banner-mobile": { label: "Баннер на главной, телефон", short: "Телефон", width: 686, height: 400 },
  category: { label: "Картинка категории", short: "Категория", width: 400, height: 400 },
  part: { label: "Фото детали", short: "Фото", width: 2000, height: 2000, note: "Квадратный кадр: деталь целиком, ровный фон." },
  "part-closeup": { label: "Крупный план детали", short: "Крупный план", width: 3000, height: 3000, note: "Для номера, бирки или дефекта — снимайте ближе и при дневном свете." },
  "part-preview": { label: "Превью детали", short: "Превью", width: 400, height: 400 },
  donor: { label: "Фото машины-донора", short: "Машина", width: 1200, height: 900 },
  "brand-logo": { label: "Логотип бренда", short: "Логотип", width: 240, height: 120, note: "Лучше загрузить PNG с прозрачным фоном." },
  "make-logo": { label: "Логотип марки", short: "Логотип", width: 240, height: 120, note: "Лучше загрузить PNG с прозрачным фоном." },
  article: { label: "Картинка статьи", short: "Статья", width: 1200, height: 630 },
  "catalog-banner": { label: "Баннер в каталоге", short: "Каталог", width: 1064, height: 160 },
  "footer-banner": { label: "Баннер в подвале", short: "Подвал", width: 1336, height: 120 },
} satisfies Record<string, ImagePreset>;

export type PresetId = keyof typeof presets;
export const imagePresets: Record<PresetId, ImagePreset> = presets;
export const bannerPresets: PresetId[] = ["banner-desktop", "banner-tablet", "banner-mobile"];
export const maxFileBytes = 15 * 1024 * 1024;
export const maxSidePixels = 12000;
/** Превью рисуется из того же кадра: в списках и карточках тяжёлый снимок не нужен. */
export const previewPreset: PresetId = "part-preview";

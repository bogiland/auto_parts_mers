import "server-only";

import sharp from "sharp";
import type { Metadata, Sharp } from "sharp";

/**
 * Единственное место, где из присланных байт получается файл на диске.
 *
 * Раньше байты писались как есть: проверялись только первые четыре байта и размер.
 * Этого мало — внутри может лежать что угодно, вплоть до исполняемого файла
 * с подрисованной сигнатурой, а в снимке с телефона остаются координаты съёмки.
 * Поэтому картинка теперь полностью разбирается и записывается заново в WebP:
 * всё, что не разобралось как картинка, до диска не доходит, а служебные блоки
 * (EXIF, GPS, ICC, XMP) в новый файл не переносятся.
 */

/** Сколько точек разрешено разбирать. «Бомба» 20000×20000 — это 400 млн, она отсекается здесь. */
export const maxInputPixels = 30_000_000;

/** Длинная сторона готового файла. Больше витрине не нужно, а вес растёт заметно. */
const maxSide = 2000;

export class ImageRejected extends Error {
  constructor(message: string) { super(message); this.name = "ImageRejected"; }
}

const dataUrl = /^data:image\/(webp|jpeg|jpg|png|avif|gif);base64,([A-Za-z0-9+/=]+)$/;

/** Типы, которые мы готовы разбирать. Всё остальное — отказ, даже если расширение «правильное». */
const accepted = new Set(["webp", "jpeg", "png", "avif", "gif"]);

export type EncodedImage = { bytes: Buffer; extension: "webp" };

/**
 * Разбирает присланную строку и возвращает байты WebP.
 * Бросает `ImageRejected` с текстом, который можно показать человеку.
 */
export async function encodeImage(value: string, maxBytes: number): Promise<EncodedImage> {
  const match = dataUrl.exec(value);
  if (!match) throw new ImageRejected("Неверный формат картинки.");
  const input = Buffer.from(match[2], "base64");
  if (input.length < 12) throw new ImageRejected("Файл картинки повреждён.");
  // Предел на входе: base64 раздувает на треть, поэтому сверяем уже распакованные байты.
  if (input.length > maxBytes * 4) throw new ImageRejected(`Картинка тяжелее ${Math.round(maxBytes / 1000)} КБ.`);

  let pipeline: Sharp;
  let meta: Metadata;
  try {
    // limitInputPixels считается по заголовку, до распаковки: огромный холст
    // отклоняется, не занимая память.
    pipeline = sharp(input, { limitInputPixels: maxInputPixels, animated: false });
    meta = await pipeline.metadata();
  } catch {
    throw new ImageRejected("Не удалось прочитать картинку.");
  }

  if (!meta.format || !accepted.has(meta.format)) throw new ImageRejected("Неверный формат картинки.");
  if (!meta.width || !meta.height) throw new ImageRejected("Файл картинки повреждён.");
  if (meta.width * meta.height > maxInputPixels) throw new ImageRejected("Картинка слишком большая.");

  let bytes: Buffer;
  try {
    bytes = await pipeline
      .rotate() // поворот из EXIF применяется к точкам, сам блок дальше не идёт
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    throw new ImageRejected("Не удалось обработать картинку.");
  }

  if (bytes.length > maxBytes) throw new ImageRejected(`Картинка тяжелее ${Math.round(maxBytes / 1000)} КБ после сжатия.`);
  return { bytes, extension: "webp" };
}

/**
 * Три размера фото детали (П7): оригинал до 2000 px (крупный план — до 3000),
 * превью 400 px для списков и миниатюра 96 px для ленты в галерее.
 * Превью в списке должно весить меньше 15 КБ: если не уложилось, качество снижается ступенями.
 */
export type PartImageSet = { full: Buffer; preview: Buffer; thumb: Buffer };

export const previewBudget = 15_000;

export async function encodePartImage(value: string, closeup: boolean): Promise<PartImageSet> {
  const match = dataUrl.exec(value);
  if (!match) throw new ImageRejected("Неверный формат картинки.");
  const input = Buffer.from(match[2], "base64");
  const limit = closeup ? 6_000_000 : 4_000_000;
  if (input.length > limit * 2) throw new ImageRejected(`Картинка тяжелее ${Math.round(limit / 1_000_000)} МБ.`);
  let meta: Metadata;
  try { meta = await sharp(input, { limitInputPixels: maxInputPixels }).metadata(); }
  catch { throw new ImageRejected("Не удалось прочитать картинку."); }
  if (!meta.format || !accepted.has(meta.format) || !meta.width || !meta.height) throw new ImageRejected("Неверный формат картинки.");
  if (meta.width * meta.height > maxInputPixels) throw new ImageRejected("Картинка слишком большая.");
  const base = () => sharp(input, { limitInputPixels: maxInputPixels, animated: false }).rotate();
  try {
    const side = closeup ? 3000 : 2000;
    const full = await base().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    // Сначала снижаем качество на 400 px; если кадр очень «пёстрый» и всё равно тяжелее 15 КБ —
    // уменьшаем сторону. Обычное фото детали укладывается уже на первых ступенях.
    let preview = Buffer.alloc(0);
    search: for (const side of [400, 360, 320, 280, 240]) {
      for (const quality of [72, 62, 52, 42, 34, 26, 20]) {
        preview = await base().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
        if (preview.length <= previewBudget) break search;
      }
    }
    const thumb = await base().resize({ width: 96, height: 96, fit: "cover" }).webp({ quality: 60, effort: 5 }).toBuffer();
    return { full, preview, thumb };
  } catch {
    throw new ImageRejected("Не удалось обработать картинку.");
  }
}

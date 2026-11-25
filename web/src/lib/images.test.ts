import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { encodeImage, ImageRejected, maxInputPixels } from "@/lib/images";

/** Контрольная сумма блока PNG: нужна, чтобы подделанный заголовок остался читаемым файлом. */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const asDataUrl = (bytes: Buffer, type = "png") => `data:image/${type};base64,${bytes.toString("base64")}`;

async function realPng(width = 40, height = 40) {
  return await sharp({ create: { width, height, channels: 3, background: "#ff0000" } }).png().toBuffer();
}

describe("приём картинок", () => {
  it("переименованный исполняемый файл не проходит", async () => {
    // Заголовок PE, но расширение и MIME — картиночные: ровно так прячут файл в загрузке.
    const exe = Buffer.concat([Buffer.from("MZ\u0090\u0000\u0003\u0000\u0000\u0000", "binary"), Buffer.alloc(4096, 0x41)]);
    await expect(encodeImage(asDataUrl(exe), 900_000)).rejects.toBeInstanceOf(ImageRejected);
  });

  it("файл с подрисованной сигнатурой PNG не проходит", async () => {
    // Восемь правильных байт в начале — и дальше мусор. Прежняя проверка смотрела только на них.
    const faked = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4096, 0x42)]);
    await expect(encodeImage(asDataUrl(faked), 900_000)).rejects.toBeInstanceOf(ImageRejected);
  });

  it("холст 20000×20000 не проходит", async () => {
    // Файл маленький, а при распаковке это 400 млн точек: предел — 30 млн.
    expect(20000 * 20000).toBeGreaterThan(maxInputPixels);
    const bomb = Buffer.from(await realPng(8, 8));
    bomb.writeUInt32BE(20000, 16);
    bomb.writeUInt32BE(20000, 20);
    bomb.writeUInt32BE(crc32(bomb.subarray(12, 29)), 29);
    await expect(encodeImage(asDataUrl(bomb), 900_000)).rejects.toBeInstanceOf(ImageRejected);
  });

  it("пустая строка и не-картинка не проходят", async () => {
    await expect(encodeImage("", 900_000)).rejects.toBeInstanceOf(ImageRejected);
    await expect(encodeImage("data:text/html;base64,PHNjcmlwdD4=", 900_000)).rejects.toBeInstanceOf(ImageRejected);
    await expect(encodeImage("/etc/passwd", 900_000)).rejects.toBeInstanceOf(ImageRejected);
  });

  it("обычная картинка проходит и становится WebP", async () => {
    const result = await encodeImage(asDataUrl(await realPng()), 900_000);
    expect(result.extension).toBe("webp");
    expect((await sharp(result.bytes).metadata()).format).toBe("webp");
  });

  it("EXIF с координатами съёмки в готовый файл не попадает", async () => {
    const withExif = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#00ff00" } })
      .withExif({ IFD0: { Copyright: "NAA", Software: "QA" }, IFD2: { GPSLatitudeRef: "N" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const result = await encodeImage(asDataUrl(withExif, "jpeg"), 900_000);
    expect((await sharp(result.bytes).metadata()).exif).toBeUndefined();
  });

  it("слишком тяжёлый результат не проходит", async () => {
    const photo = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: "#123456" } })
      .png()
      .toBuffer();
    await expect(encodeImage(asDataUrl(photo), 200)).rejects.toBeInstanceOf(ImageRejected);
  });
});

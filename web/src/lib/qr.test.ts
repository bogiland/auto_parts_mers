import { describe, expect, it } from "vitest";
import { qrMatrix, qrSvg } from "./qr";

// Декодер написан отдельно от кодировщика и повторяет шаги сканера: формат → снятие маски →
// чтение змейкой → проверка кодов Рида — Соломона → разбор байтов. Если строка вернулась целой,
// а остаток коррекции нулевой, код читаемый.
const formatBits = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];
const alignment: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const layouts: { ec: number; groups: [number, number][] }[] = [
  { ec: 10, groups: [[1, 16]] }, { ec: 16, groups: [[1, 28]] }, { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] }, { ec: 24, groups: [[2, 43]] }, { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] }, { ec: 22, groups: [[2, 38], [2, 39]] }, { ec: 22, groups: [[3, 36], [2, 37]] },
  { ec: 26, groups: [[4, 43], [1, 44]] },
];

const exp = new Uint8Array(512);
const log = new Uint8Array(256);
for (let i = 0, value = 1; i < 255; i += 1) {
  exp[i] = value;
  log[value] = i;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
const multiply = (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);

function syndromes(codewords: number[], ec: number) {
  // Для верного кодового слова значение полинома в корнях генератора равно нулю.
  return Array.from({ length: ec }, (_, root) => codewords.reduce((value, byte) => multiply(value, exp[root]) ^ byte, 0));
}

const maskAt = (mask: number, x: number, y: number) => {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
};

function functionModules(size: number, version: number) {
  const taken = new Set<string>();
  const mark = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < size && y < size) taken.add(`${x},${y}`); };
  for (const [left, top] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    for (let y = -1; y <= 7; y += 1) for (let x = -1; x <= 7; x += 1) mark(left + x, top + y);
  }
  for (let i = 0; i < size; i += 1) { mark(i, 6); mark(6, i); }
  for (const cy of alignment[version]) for (const cx of alignment[version]) {
    if (taken.has(`${cx},${cy}`)) continue;
    for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) mark(cx + x, cy + y);
  }
  for (let i = 0; i < 9; i += 1) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i += 1) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (version + 1 >= 7) {
    for (let i = 0; i < 18; i += 1) {
      mark(size - 11 + (i % 3), Math.floor(i / 3));
      mark(Math.floor(i / 3), size - 11 + (i % 3));
    }
  }
  return taken;
}

function decode(matrix: boolean[][]) {
  const size = matrix.length;
  const version = (size - 17) / 4 - 1;
  const read = (x: number, y: number) => matrix[y][x];
  const formatRead = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  let format = 0;
  formatRead.forEach(([x, y], index) => { if (read(x, y)) format |= 1 << index; });
  const mask = formatBits.indexOf(format);
  expect(mask, "в полосе формата должен лежать уровень M и номер маски").toBeGreaterThanOrEqual(0);

  const taken = functionModules(size, version);
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let row = 0; row < size; row += 1) {
      const y = upward ? size - 1 - row : row;
      for (const x of [right, right - 1]) {
        if (x < 0 || taken.has(`${x},${y}`)) continue;
        bits.push((read(x, y) !== maskAt(mask, x, y)) ? 1 : 0);
      }
    }
    upward = !upward;
  }
  const stream: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) stream.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));

  const layout = layouts[version];
  const sizes = layout.groups.flatMap(([count, length]) => Array.from({ length: count }, () => length));
  const longest = Math.max(...sizes);
  const data: number[][] = sizes.map(() => []);
  let cursor = 0;
  for (let i = 0; i < longest; i += 1) for (let block = 0; block < sizes.length; block += 1) if (i < sizes[block]) data[block].push(stream[cursor++]);
  const parity: number[][] = sizes.map(() => []);
  for (let i = 0; i < layout.ec; i += 1) for (let block = 0; block < sizes.length; block += 1) parity[block].push(stream[cursor++]);
  for (let block = 0; block < sizes.length; block += 1) {
    expect(syndromes([...data[block], ...parity[block]], layout.ec), `блок ${block + 1} должен проходить проверку коррекции`).toEqual(new Array(layout.ec).fill(0));
  }

  const payload = data.flat();
  const flat: number[] = [];
  for (const byte of payload) for (let i = 7; i >= 0; i -= 1) flat.push((byte >> i) & 1);
  const take = (length: number) => flat.splice(0, length).reduce((value, bit) => (value << 1) | bit, 0);
  expect(take(4), "режим должен быть байтовым").toBe(0b0100);
  const length = take(version + 1 >= 10 ? 16 : 8);
  return new TextDecoder().decode(Uint8Array.from(Array.from({ length }, () => take(8))));
}

describe("qr", () => {
  const samples = [
    "https://naa.md/order/s/8c0d5c06-6a9f-4f7e-8e0c-1f2a3b4c5d6e",
    "NAA",
    "https://naa.md/order/s/00000000-0000-4000-8000-000000000000?from=receipt",
    "Чек № 1030",
    "x".repeat(213),
  ];

  for (const text of samples) {
    it(`читается обратно: ${text.slice(0, 32)}`, () => {
      const matrix = qrMatrix(text);
      expect(decode(matrix)).toBe(text);
    });
  }

  it("ставит три поисковых квадрата по углам", () => {
    const matrix = qrMatrix("https://naa.md/order/s/8c0d5c06-6a9f-4f7e-8e0c-1f2a3b4c5d6e");
    const size = matrix.length;
    for (const [left, top] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      expect(matrix[top][left]).toBe(true);
      expect(matrix[top + 1][left + 1]).toBe(false);
      expect(matrix[top + 3][left + 3]).toBe(true);
    }
  });

  it("отказывается кодировать слишком длинный текст", () => {
    expect(() => qrMatrix("x".repeat(214))).toThrow(/слишком длинный/);
  });

  it("отдаёт SVG с белым полем вокруг кода", () => {
    const svg = qrSvg("NAA", 120);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="120"');
    expect(svg).toContain("viewBox=\"0 0 29 29\"");
  });
});

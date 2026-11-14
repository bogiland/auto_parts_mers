// QR-код для чека: готовой библиотеки в проекте нет, поэтому кодировщик свой.
// Режим «байты», уровень коррекции M, версии 1–10 — этого хватает для ссылки на статус заказа.

const totalCodewords = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
// По версиям: сколько байт коррекции в блоке и как данные разбиты на блоки.
const layouts: { ec: number; groups: [number, number][] }[] = [
  { ec: 10, groups: [[1, 16]] },
  { ec: 16, groups: [[1, 28]] },
  { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] },
  { ec: 24, groups: [[2, 43]] },
  { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] },
  { ec: 22, groups: [[2, 38], [2, 39]] },
  { ec: 22, groups: [[3, 36], [2, 37]] },
  { ec: 26, groups: [[4, 43], [1, 44]] },
];
const alignment: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const versionBits = [0, 0, 0, 0, 0, 0, 0x07c94, 0x085bc, 0x09a99, 0x0a4d3];
const formatBits = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

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

function generator(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= multiply(poly[j], exp[i]);
    }
    poly = next;
  }
  return poly;
}

function remainder(data: number[], degree: number) {
  const poly = generator(degree);
  const result = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i += 1) result[i] ^= multiply(poly[i + 1], factor);
  }
  return result;
}

type Grid = { size: number; modules: Uint8Array; taken: Uint8Array };
const dark = (grid: Grid, x: number, y: number) => grid.modules[y * grid.size + x] === 1;

function put(grid: Grid, x: number, y: number, value: boolean, reserve = true) {
  grid.modules[y * grid.size + x] = value ? 1 : 0;
  if (reserve) grid.taken[y * grid.size + x] = 1;
}

function finder(grid: Grid, left: number, top: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const px = left + x;
      const py = top + y;
      if (px < 0 || py < 0 || px >= grid.size || py >= grid.size) continue;
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      put(grid, px, py, ring !== 2 && ring <= 3);
    }
  }
}

function penalty(grid: Grid) {
  const size = grid.size;
  let score = 0;
  for (let line = 0; line < size; line += 1) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let step = 1; step < size; step += 1) {
        const current = horizontal ? dark(grid, step, line) : dark(grid, line, step);
        const previous = horizontal ? dark(grid, step - 1, line) : dark(grid, line, step - 1);
        if (current === previous) run += 1;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const value = dark(grid, x, y);
      if (value === dark(grid, x + 1, y) && value === dark(grid, x, y + 1) && value === dark(grid, x + 1, y + 1)) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true];
  const looksLikeFinder = (read: (offset: number) => boolean) => {
    if (!pattern.every((value, index) => read(index) === value)) return false;
    return [-4, -3, -2, -1].every((offset) => !read(offset)) || [7, 8, 9, 10].every((offset) => !read(offset));
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (looksLikeFinder((offset) => x + offset >= 0 && x + offset < size && dark(grid, x + offset, y))) score += 40;
      if (looksLikeFinder((offset) => y + offset >= 0 && y + offset < size && dark(grid, x, y + offset))) score += 40;
    }
  }
  let filled = 0;
  for (let i = 0; i < grid.modules.length; i += 1) filled += grid.modules[i];
  score += Math.floor(Math.abs(filled * 20 - grid.modules.length * 10) / grid.modules.length) * 10;
  return score;
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

/** Матрица тёмных модулей без белого поля. Бросает ошибку, если текст длиннее 213 байт. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  const version = layouts.findIndex((layout, index) => {
    const data = layout.groups.reduce((sum, [count, size]) => sum + count * size, 0);
    return data * 8 - (index + 1 >= 10 ? 20 : 12) >= bytes.length * 8;
  });
  if (version < 0) throw new Error("Текст слишком длинный для QR-кода.");
  const layout = layouts[version];
  const dataCodewords = layout.groups.reduce((sum, [count, size]) => sum + count * size, 0);

  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version + 1 >= 10 ? 16 : 8);
  for (const byte of bytes) push(byte, 8);
  for (let i = 0; i < 4 && bits.length < dataCodewords * 8; i += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let i = 0; words.length < dataCodewords; i += 1) words.push(i % 2 === 0 ? 0xec : 0x11);

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [count, size] of layout.groups) {
    for (let i = 0; i < count; i += 1) {
      const block = words.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      ecBlocks.push(remainder(block, layout.ec));
    }
  }
  const stream: number[] = [];
  const longest = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < longest; i += 1) for (const block of dataBlocks) if (i < block.length) stream.push(block[i]);
  for (let i = 0; i < layout.ec; i += 1) for (const block of ecBlocks) stream.push(block[i]);
  if (stream.length !== totalCodewords[version]) throw new Error("Сбой сборки QR-кода.");

  const size = 17 + (version + 1) * 4;
  const base: Grid = { size, modules: new Uint8Array(size * size), taken: new Uint8Array(size * size) };
  finder(base, 0, 0);
  finder(base, size - 7, 0);
  finder(base, 0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    put(base, i, 6, i % 2 === 0);
    put(base, 6, i, i % 2 === 0);
  }
  for (const cy of alignment[version]) {
    for (const cx of alignment[version]) {
      if (base.taken[cy * size + cx]) continue;
      for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) put(base, cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
  }
  put(base, 8, size - 8, true);
  for (let i = 0; i < 9; i += 1) {
    put(base, 8, i, false);
    put(base, i, 8, false);
  }
  for (let i = 0; i < 8; i += 1) {
    put(base, size - 1 - i, 8, false);
    put(base, 8, size - 1 - i, false);
  }
  if (version + 1 >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const bit = ((versionBits[version] >> i) & 1) === 1;
      put(base, size - 11 + (i % 3), Math.floor(i / 3), bit);
      put(base, Math.floor(i / 3), size - 11 + (i % 3), bit);
    }
  }

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const grid: Grid = { size, modules: Uint8Array.from(base.modules), taken: Uint8Array.from(base.taken) };
    let index = 0;
    let upward = true;
    // Змейка: столбцы парами справа налево, шестой столбец занят синхродорожкой и пропускается.
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5;
      for (let row = 0; row < size; row += 1) {
        const y = upward ? size - 1 - row : row;
        for (const x of [right, right - 1]) {
          if (x < 0 || grid.taken[y * size + x]) continue;
          const bit = index < stream.length * 8 ? (stream[index >> 3] >> (7 - (index & 7))) & 1 : 0;
          index += 1;
          put(grid, x, y, (bit === 1) !== maskAt(mask, x, y), false);
        }
      }
      upward = !upward;
    }
    for (let i = 0; i < 15; i += 1) {
      const bit = ((formatBits[mask] >> i) & 1) === 1;
      if (i < 6) put(grid, 8, i, bit);
      else if (i < 8) put(grid, 8, i + 1, bit);
      else if (i === 8) put(grid, 7, 8, bit);
      else put(grid, 14 - i, 8, bit);
      if (i < 8) put(grid, size - 1 - i, 8, bit);
      else put(grid, 8, size - 15 + i, bit);
    }
    const score = penalty(grid);
    if (score < bestScore) {
      bestScore = score;
      best = grid;
    }
  }
  const grid = best!;
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => dark(grid, x, y)));
}

/** Готовый SVG для чека: не зависит от внешних сервисов и печатается как есть. */
export function qrSvg(text: string, pixels = 120) {
  const matrix = qrMatrix(text);
  const size = matrix.length + 8;
  const path = matrix.flatMap((row, y) => row.map((value, x) => (value ? `M${x + 4} ${y + 4}h1v1h-1z` : ""))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${pixels}" height="${pixels}" shape-rendering="crispEdges" role="img" aria-label="QR-код со ссылкой на заказ"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}

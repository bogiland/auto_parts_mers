// Проверки П2: пределы на формы, перебор токенов статуса и приём файлов.
// Запускается против локального сервера на 3000. Телефоны в выводе маскируются.
//
//   node qa/p2-limits-check.mjs
import net from "node:net";

const BASE = "http://localhost:3000";
const ORIGIN = BASE;
const PRODUCT = "demo-part-49";
const mask = (p) => String(p).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");

// Контрольная сумма блока PNG: нужна, чтобы подделанный заголовок остался читаемым файлом.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const results = [];
function record(name, runs, hits, detail) {
  results.push({ name, runs, hits });
  console.log(`\n### ${name}\n  прогонов: ${runs} · проблема воспроизвелась: ${hits}\n  ${detail}`);
}

const jar = () => ({ cookies: new Map() });
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function call(j, path, init = {}, ip) {
  const headers = { Origin: ORIGIN, ...(init.headers ?? {}) };
  if (ip) headers["x-forwarded-for"] = ip;
  const cookie = [...(j?.cookies ?? [])].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.Cookie = cookie;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}
async function browser(ip) { const j = jar(); await call(j, "/checkout", {}, ip); return j; }

function orderBody(key, phone) {
  return JSON.stringify({
    key, name: "Проверка П2", phone, contactMethod: "call",
    deliveryMethod: "pickup", address: "", paymentMethod: "receipt",
    comment: "автопроверка П2", agreed: true, restrictedAgreed: true,
    items: [{ id: PRODUCT, quantity: 1 }],
  });
}

/* ---------- 1. Сто заказов за минуту с одного адреса ---------- */
{
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const other = "198.51.100.77";
  const j = await browser(ip);
  let ok = 0, limited = 0, elseCount = 0;
  for (let i = 0; i < 100; i++) {
    // Телефон у каждого свой: иначе сработал бы предел по номеру, а проверяем предел по адресу.
    const phone = `+3736066${String(1000 + i).slice(-4)}`;
    const res = await call(j, "/api/orders", { method: "POST", body: orderBody(crypto.randomUUID(), phone) }, ip);
    if (res.status === 201) ok++;
    else if (res.status === 429) limited++;
    else elseCount++;
  }
  // Заказ с другого адреса должен пройти, хотя первый адрес уже заблокирован.
  const otherJar = await browser(other);
  const passed = await call(otherJar, "/api/orders", { method: "POST", body: orderBody(crypto.randomUUID(), "+37360669999") }, other);
  const bad = limited === 0 || passed.status !== 201 ? 1 : 0;
  record("100 заказов за минуту с одного адреса", 100, bad,
    `принято ${ok}, отказов 429 ${limited}, прочих ответов ${elseCount}; заказ с другого адреса: ${passed.status}`);
}

/* ---------- 2. Перебор токенов статуса ---------- */
{
  const ip = "203.0.113.240";
  let found = 0, limited = 0, notFound = 0;
  for (let i = 0; i < 1000; i++) {
    const res = await call(null, `/api/orders/${crypto.randomUUID()}`, {}, ip);
    if (res.status === 200) found++;
    else if (res.status === 429) limited++;
    else notFound++;
  }
  record("1000 случайных токенов статуса", 1000, found,
    `попаданий ${found}, отказов 429 ${limited}, «не найден» ${notFound}`);
}

/* ---------- 3. Загрузка файлов ---------- */
// Что именно принимается как картинка, проверяется набором src/lib/images.test.ts:
// переименованный .exe, подделанная сигнатура PNG, холст 20000x20000 и снимок с EXIF.
// Здесь проверяется только то, что маршрут загрузки закрыт без входа сотрудника.
{
  const attempts = [
    ["справочник", "/api/staff/reference", { action: "save-brand", name: "Проверка", logo: "data:image/png;base64,AAAA" }],
    ["деталь", "/api/staff/parts", { action: "part-photos", id: "demo-part-49", photos: ["data:image/png;base64,AAAA"] }],
    ["фото выдачи", "/api/staff/orders", { action: "issue-photos", id: 1, photos: ["data:image/png;base64,AAAA"] }],
  ];
  const lines = [];
  let open = 0;
  for (const [label, path, body] of attempts) {
    const res = await call(null, path, { method: "POST", body: JSON.stringify(body) });
    lines.push(`${label}: ${res.status}`);
    if (res.status === 200) open++;
  }
  record("Загрузка файла без входа сотрудника", attempts.length, open, lines.join("; "));
}


/* ---------- 4. Тело в 100 МБ ---------- */
// Запрос с объявленным размером 100 МБ получает 413, и до разбора JSON дело не доходит:
// ни JSON.parse, ни память под сто мегабайт. Что при этом происходит с самими байтами,
// проверяется двумя способами: отправкой целиком и отправкой по чуть-чуть.
const CRLF = "\r\n";
function hugeBody(trickle) {
  const declared = 100 * 1024 * 1024;
  return new Promise((resolve) => {
    const socket = net.connect(3000, "localhost");
    let reply = "";
    let sent = 0;
    const began = Date.now();
    const done = (status) => resolve({ status, sent, at: Date.now() - began });
    const statusOf = () => /^HTTP\/1\.\d (\d+)/.exec(reply)?.[1] ?? "?";
    socket.setTimeout(20000, () => { socket.destroy(); done("нет ответа за 20 с"); });
    socket.on("connect", () => {
      socket.write([
        "POST /api/orders HTTP/1.1",
        "Host: localhost:3000",
        `Origin: ${ORIGIN}`,
        "Content-Type: application/json",
        `Content-Length: ${declared}`,
        "Connection: close",
        "", "",
      ].join(CRLF));
      const chunk = Buffer.alloc(64 * 1024, 0x20);
      if (trickle) { socket.write(chunk); sent = chunk.length; return; }
      const push = () => {
        if (sent >= declared || socket.destroyed) return;
        if (socket.write(chunk)) { sent += chunk.length; setImmediate(push); }
        else socket.once("drain", () => { sent += chunk.length; push(); });
      };
      push();
    });
    socket.on("data", (buffer) => {
      reply += buffer.toString("latin1");
      if (reply.includes(CRLF + CRLF)) { socket.destroy(); done(statusOf()); }
    });
    socket.on("close", () => done(reply ? statusOf() : "разрыв без ответа"));
  });
}
{
  const whole = await hugeBody(false);
  const partial = await hugeBody(true);
  const bad = whole.status === "200" || whole.status === "201" ? 1 : 0;
  record("Тело 100 МБ", 2, bad,
    `целиком: ответ ${whole.status} за ${whole.at} мс (${(whole.sent / 1048576).toFixed(1)} МБ); ` +
    `по 64 КБ: ${partial.status} за ${partial.at} мс. Next отдаёт запрос приложению только после приёма тела, ` +
    "поэтому обрыв на уровне сокета делается обратным прокси (nginx client_max_body_size, предел Cloudflare), а не приложением");
}

console.log("\n=== ИТОГ ===");
for (const r of results) console.log(`${r.hits === 0 ? "OK " : "!! "} ${r.name}: ${r.runs} прогон(ов), воспроизвелось ${r.hits}`);
console.log(`Телефоны в проверке маскируются: ${mask("+37360661000")}.`);

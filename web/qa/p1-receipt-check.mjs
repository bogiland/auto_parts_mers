// П1.3/П1.4 — чек по ссылке, срок и отзыв ссылки, фото выдачи, телефон в API.
const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const PHONE = "+37360900011";
const PASS = process.env.P1_PASS;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const jar = () => ({ cookies: new Map() });
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
const header = (j) => [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
async function call(j, path, init = {}) {
  const headers = { ...ORIGIN, ...(init.headers ?? {}) };
  const c = j ? header(j) : "";
  if (c) headers.Cookie = c;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}
const staffPost = (j, body) => call(j, "/api/staff/orders", { method: "POST", body: JSON.stringify(body) });

const out = [];
const say = (s) => { out.push(s); console.log(s); };

const staff = jar();
const login = await call(staff, "/api/staff/login", { method: "POST", body: JSON.stringify({ phone: PHONE, password: PASS }) });
if (login.status !== 200) { console.error("Сотрудник не вошёл:", login.status); process.exit(1); }

// Берём свой проверочный заказ и доводим его до «Выдан».
const orderId = Number(process.argv[2]);
let detail = await (await staffPost(staff, { action: "order-detail", id: orderId })).json();
say(`\n### Телефон в обычном ответе API заказов`);
say(`  в ответе order-detail есть поле phone: ${Object.prototype.hasOwnProperty.call(detail.order, "phone")}; маска: ${detail.order.phoneMasked}`);
const revealed = await (await staffPost(staff, { action: "order-phone", id: orderId })).json();
say(`  полный номер отдаётся отдельным действием order-phone: ${revealed.ok === true}`);

let guard = 0;
while (detail.order.status !== "issued" && guard++ < 6) {
  const next = detail.order.next.find((s) => !["cancelled", "returned"].includes(s));
  if (!next) break;
  await staffPost(staff, { action: "order-status", id: orderId, status: next, version: detail.order.version, comment: "проверка П1" });
  detail = await (await staffPost(staff, { action: "order-detail", id: orderId })).json();
}
say(`\n  статус заказа № ${detail.order.number}: ${detail.order.status}`);

// Фото выдачи
const photos = await (await staffPost(staff, { action: "issue-photos", id: orderId, photos: [{ src: PNG, closeup: false }], version: detail.order.version })).json();
const photoUrl = photos.photos?.[0]?.src ?? "";
const photoAnon = await fetch(BASE + photoUrl, { redirect: "manual" });
const photoStaff = await call(staff, photoUrl);
say(`\n### Фото выдачи`);
say(`  адрес фото: ${photoUrl.replace(/[a-f0-9]{32}/, "<файл>")}`);
say(`  без входа: ${photoAnon.status} · сотруднику: ${photoStaff.status}`);
say(`  лежит вне public: ${!photoUrl.startsWith("/uploads/")}`);

detail = await (await staffPost(staff, { action: "order-detail", id: orderId })).json();
const receipt = await (await staffPost(staff, { action: "receipt", id: orderId, version: detail.order.version })).json();
const token = receipt.token;
say(`\n### Чек по ссылке`);
say(`  чек сформирован: ${receipt.ok === true} · срок до ${receipt.expiresAt ?? "—"}`);

const anon = await fetch(`${BASE}/receipt/${token}`, { redirect: "manual" });
const anonHtml = await anon.text();
const asStaff = await call(staff, `/receipt/${token}`);
const staffHtml = await asStaff.text();
const fullPhone = detail.order.phoneMasked;
const realPhone = revealed.phone ?? "";
say(`  гость: ${anon.status}; видит полный телефон: ${anonHtml.includes(realPhone)}; видит адрес заказа: ${Boolean(detail.order.address) && anonHtml.includes(detail.order.address)}; видит имя: ${anonHtml.includes(detail.order.name)}`);
say(`  сотрудник: ${asStaff.status}; видит полный телефон: ${staffHtml.includes(realPhone)}`);
say(`  заголовки гостю: cache-control=${anon.headers.get("cache-control")}; referrer-policy=${anon.headers.get("referrer-policy")}`);

console.log(`\nRECEIPT_TOKEN=${token}\nORDER_VERSION_HINT=${detail.order.version}`);

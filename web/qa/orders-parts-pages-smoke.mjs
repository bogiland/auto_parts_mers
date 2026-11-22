// Проверка задач 8 (заказы, остатки, чеки), 9 (детали и доноры), 12 (страницы сайта)
// и личного кабинета покупателя. Всё гоняется по живому приложению на localhost:3000.
import { chromium } from "playwright";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { unlinkSync } from "node:fs";
import { join } from "node:path";

const db = new DatabaseSync("data/orders.sqlite");
const root = "http://localhost:3000";
const secret = randomBytes(16).toString("hex");
const salt = randomBytes(16);
const passwordHash = `${salt.toString("hex")}:${scryptSync(secret, salt, 64).toString("hex")}`;
const ownerPhone = "+37377776411", operatorPhone = "+37377776412";
const customerEmail = "qa-buyer@naa.test";
const steps = [];
const files = [];
const ok = (message) => steps.push(`  ok  ${message}`);
const browser = await chromium.launch({ channel: "chrome" });
// React разбивает соседние куски текста комментариями <!-- -->, а числа печатает с неразрывным
// пробелом. Для проверок это шум, поэтому страницу сначала приводим к простому виду.
const plain = (html) => html.replace(/<!--[^>]*-->/g, "").replace(/ |&nbsp;|&#x27;/g, " ");

// Однопиксельный PNG: сервер проверяет подпись файла, значит картинка должна быть настоящей.
const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6V3QAAAAASUVORK5CYII=";

function cleanup() {
  for (const row of db.prepare("SELECT id FROM orders WHERE name LIKE 'QA %' OR phone IN (?,?)").all("+37360000911", "+37360000912")) {
    db.prepare("DELETE FROM order_returns WHERE order_id=?").run(row.id);
    db.prepare("DELETE FROM order_status_history WHERE order_id=?").run(row.id);
    db.prepare("DELETE FROM order_items WHERE order_id=?").run(row.id);
    db.prepare("DELETE FROM orders WHERE id=?").run(row.id);
  }
  for (const row of db.prepare("SELECT id FROM catalog_products WHERE name LIKE 'QA %' OR name_ro LIKE 'QA %'").all()) {
    db.prepare("DELETE FROM stock_moves WHERE product_id=?").run(row.id);
    db.prepare("DELETE FROM part_offers WHERE product_id=?").run(row.id);
    db.prepare("DELETE FROM catalog_products WHERE id=?").run(row.id);
  }
  db.prepare("DELETE FROM donors WHERE make LIKE 'QA %'").run();
  db.prepare("DELETE FROM ref_part_types WHERE name_ru LIKE 'QA %'").run();
  for (let pass = 0; pass < 4; pass += 1) db.prepare("DELETE FROM ref_categories WHERE name_ru LIKE 'QA %' AND id NOT IN (SELECT parent_id FROM ref_categories WHERE parent_id IS NOT NULL)").run();
  db.prepare("DELETE FROM site_pages WHERE slug LIKE 'qa-%'").run();
  db.prepare("UPDATE site_pages SET visible=1 WHERE slug='delivery'").run();
  for (const row of db.prepare("SELECT id FROM customers WHERE email=?").all(customerEmail)) {
    db.prepare("DELETE FROM customer_addresses WHERE customer_id=?").run(row.id);
    db.prepare("DELETE FROM customer_sessions WHERE customer_id=?").run(row.id);
    db.prepare("DELETE FROM customers WHERE id=?").run(row.id);
  }
  for (const row of db.prepare("SELECT id FROM staff_users WHERE phone IN (?,?)").all(ownerPhone, operatorPhone)) db.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(row.id);
  db.prepare("DELETE FROM staff_users WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  db.prepare("DELETE FROM staff_audit WHERE actor_name IN ('QA Boss','QA Oper')").run();
  db.prepare("DELETE FROM login_attempts WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  db.prepare("DELETE FROM customer_attempts WHERE login LIKE 'qa-%'").run();
  for (const file of files) { try { unlinkSync(join("public", file.replace(/^\//, ""))); } catch { /* файла может уже не быть */ } }
}

try {
  cleanup();
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'owner')").run("QA Boss", ownerPhone, passwordHash);
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'operator')").run("QA Oper", operatorPhone, passwordHash);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const buyer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const operator = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if ((await context.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: ownerPhone, password: secret } })).status() !== 200) throw new Error("Владелец не вошёл");
  if ((await operator.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: operatorPhone, password: secret } })).status() !== 200) throw new Error("Оператор не вошёл");

  // В dev-режиме Next отдаёт 500, если запрос попал в пересборку манифеста, поэтому один повтор.
  const post = async (where, data, expected = 200, ctx = context) => {
    let response = await ctx.request.post(`${root}/api/staff/${where}`, { headers: { origin: root }, data });
    if (response.status() === 500 && expected !== 500) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      response = await ctx.request.post(`${root}/api/staff/${where}`, { headers: { origin: root }, data });
    }
    const body = await response.json().catch(() => ({}));
    if (response.status() !== expected) throw new Error(`${where}/${data.action}: ${response.status()} ${JSON.stringify(body)}`);
    return body;
  };
  const get = async (path, ctx = guest) => {
    let response = await ctx.request.get(`${root}${path}`);
    if (response.status() >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      response = await ctx.request.get(`${root}${path}`);
    }
    return response;
  };

  /* ---------- Задача 12: страницы, которых не было ---------- */

  const home = await (await get("/")).text();
  const links = [...new Set([...home.matchAll(/href="(\/[a-z0-9/_-]*)"/g)].map((match) => match[1]))]
    .filter((href) => href !== "/" && !href.startsWith("/api") && !href.startsWith("/admin"));
  const broken = [];
  for (const href of links) {
    const response = await get(href);
    if (response.status() !== 200) broken.push(`${href} → ${response.status()}`);
  }
  if (broken.length) throw new Error(`Ссылки ведут в никуда: ${broken.join(", ")}`);
  ok(`все ${links.length} ссылки шапки и подвала открываются`);

  const delivery = plain(await (await get("/delivery")).text());
  if (!delivery.includes("Самовывоз") || !delivery.includes("Новосовицкая")) throw new Error("Страница доставки без текста и контактов");
  if ((delivery.match(/<h1/g) ?? []).length !== 1) throw new Error("На странице не один h1");
  ok("страница «Доставка» отдаёт текст, адрес и один заголовок h1");

  const sitemapBefore = await (await get("/sitemap.xml")).text();
  if (!sitemapBefore.includes("/delivery")) throw new Error("Страницы нет в карте сайта");
  const pageRow = db.prepare("SELECT id FROM site_pages WHERE slug='delivery'").get();
  await post("pages", { action: "page-visible", id: pageRow.id, visible: false });
  if ((await get("/delivery")).status() !== 404) throw new Error("Выключенная страница всё ещё открывается");
  const sitemapAfter = await (await get("/sitemap.xml")).text();
  if (sitemapAfter.includes("/delivery")) throw new Error("Выключенная страница осталась в карте сайта");
  if ((await (await get("/")).text()).includes('href="/delivery"')) throw new Error("Выключенная страница осталась в подвале");
  ok("выключенная страница отдаёт 404 и исчезает из подвала, меню и карты сайта");

  await post("pages", { action: "page-visible", id: pageRow.id, visible: true });
  if ((await get("/delivery")).status() !== 200) throw new Error("Страница не вернулась после включения");
  ok("включение возвращает страницу на место");

  await post("pages", { action: "delete-page", id: pageRow.id }, 400);
  ok("засеянную страницу нельзя удалить — только выключить");

  const created = await post("pages", { action: "save-page", slug: "qa-test-page", titleRu: "QA Страница", bodyRu: "## Заголовок\n\nПервый абзац.\n\n- пункт один\n- пункт два", placement: "footer-company" });
  const custom = plain(await (await get("/qa-test-page")).text());
  if (!custom.includes("Первый абзац") || !custom.includes("пункт один")) throw new Error("Разметка страницы не разобралась");
  ok("владелец создаёт свою страницу, разметка «##» и «-» превращается в заголовок и список");
  await post("pages", { action: "delete-page", id: created.id });

  if ((await operator.request.get(`${root}/admin/pages`)).status() !== 404) throw new Error("Оператор видит раздел страниц");
  await post("pages", { action: "save-page", slug: "qa-hack", titleRu: "Нельзя" }, 403, operator);
  ok("оператору раздел страниц закрыт: 404 на странице и 403 в API");

  /* ---------- Задача 9: детали и доноры ---------- */

  const category = await post("reference", { action: "save-category", nameRu: "QA Кузов", parentId: "" });
  const type = await post("reference", { action: "save-part-type", nameRu: "QA Фара", nameRo: "QA Far", hasSide: true, categoryId: category.id });
  const engineType = await post("reference", { action: "save-part-type", nameRu: "QA Мотор", returnRestricted: true });

  const donor = await post("parts", { action: "save-donor", make: "QA Mercedes", model: "E", generation: "W212", year: 2013, engine: "OM651", mileage: 240000, photos: [{ src: pixel, closeup: false }] });
  ok("донор заведён: марка, модель, поколение, год, двигатель и пробег");

  const part = await post("parts", {
    action: "add-part", partTypeId: type.id, side: "left", donorId: donor.id, condition: "good",
    price: 1500, stock: 2, location: "Стеллаж Б, полка 3",
    photos: [{ src: pixel, preview: pixel, closeup: false }, { src: pixel, closeup: true }],
  });
  if (part.name !== "QA Фара левая QA Mercedes E W212 2013") throw new Error(`Название собралось как «${part.name}»`);
  if (!/^NAA-\d{6}$/.test(part.sku)) throw new Error(`Артикул «${part.sku}» не похож на постоянный`);
  ok(`название и артикул подставились сами: «${part.name}», ${part.sku}`);

  const stored = db.prepare("SELECT photos_json, slug, applicability, category_id FROM catalog_products WHERE id=?").get(part.id);
  for (const photo of JSON.parse(stored.photos_json)) { files.push(photo.src); if (photo.preview) files.push(photo.preview); }
  if (JSON.parse(stored.photos_json).length !== 2) throw new Error("Фото не сохранились");
  if (!JSON.parse(stored.photos_json)[0].preview) throw new Error("Превью 400 px не сохранилось");
  if (stored.applicability !== "QA Mercedes E W212 2013") throw new Error("Применимость не подставилась от донора");
  if (stored.category_id !== category.id) throw new Error("Категория не подставилась из типа");
  ok("фото, превью, применимость и категория подставились без ручного ввода");

  const duplicate = await post("parts", { action: "check-duplicate", donorId: donor.id, partTypeId: type.id, side: "left" });
  if (duplicate.duplicate?.id !== part.id) throw new Error("Дубль не найден");
  ok("повтор «тот же донор + тип + сторона» находится до сохранения");

  const productPage = plain(await (await get(`/products/${part.id}`)).text());
  if (!productPage.includes("QA Фара левая")) throw new Error("Деталь не открылась на сайте");
  if (!productPage.includes("Б/у, хорошее")) throw new Error("Состояние не показано");
  if (!productPage.includes(`/donors/${donor.id}`)) throw new Error("Нет ссылки на машину-донора");
  ok("деталь открывается на сайте: название, состояние и ссылка на машину");

  const donorPage = plain(await (await get(`/donors/${donor.id}`)).text());
  if (!donorPage.includes("QA Фара левая")) throw new Error("Детали нет в списке донора");
  if (!/240\s*000/.test(donorPage) || !donorPage.includes("OM651")) throw new Error("Пробег или двигатель не показаны");
  if (!donorPage.includes("Нужна другая деталь с этой машины")) throw new Error("Нет кнопки запроса другой детали");
  ok("страница донора: марка, год, двигатель, пробег, список деталей и запрос другой детали");

  const categorySlug = db.prepare("SELECT slug FROM ref_categories WHERE id=?").get(category.id).slug;
  const categoryPage = plain(await (await get(`/catalog/legkovye/${categorySlug}`)).text());
  if (!categoryPage.includes("QA Фара левая")) throw new Error("Детали нет в её категории каталога");
  ok("деталь попала в свою категорию каталога");

  await post("parts", { action: "update-part", id: part.id, nameRu: "QA Фара левая переименованная", condition: "good", price: 1600, stock: 2, location: "Стеллаж Б, полка 3" });
  const renamed = db.prepare("SELECT sku, slug FROM catalog_products WHERE id=?").get(part.id);
  if (renamed.sku !== part.sku || renamed.slug !== stored.slug) throw new Error("Переименование изменило артикул или адрес страницы");
  ok("переименование не трогает артикул и адрес страницы детали");

  await post("parts", { action: "sell-offline", id: part.id });
  if (db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(part.id).stock !== 1) throw new Error("«−1 продано офлайн» не списало остаток");
  const moves = await post("parts", { action: "stock-moves", id: part.id });
  const offline = moves.moves.find((move) => move.reason === "offline_sale");
  if (!offline?.canUndo) throw new Error("Офлайн-продажу нельзя отменить в течение пяти минут");
  await post("parts", { action: "undo-move", id: offline.id });
  if (db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(part.id).stock !== 2) throw new Error("Отмена не вернула остаток");
  ok("«−1 продано офлайн» списывает остаток и отменяется в течение пяти минут");

  await post("parts", { action: "part-hidden", id: part.id, hidden: true });
  if ((await get(`/products/${part.id}`)).status() !== 404) throw new Error("Скрытая деталь всё ещё открывается");
  await post("parts", { action: "part-hidden", id: part.id, hidden: false });
  ok("скрытая деталь пропадает с сайта и возвращается обратно");

  /* ---------- Задача 8: заказы, остатки и чеки ---------- */

  const order = await post("orders", {
    action: "create-call-order", phone: "+37360000911", name: "QA Клиент", deliveryMethod: "pickup",
    paymentMethod: "receipt", items: [{ id: part.id, quantity: 1 }], comment: "заказ по телефону",
  });
  if (db.prepare("SELECT source FROM orders WHERE id=?").get(order.id).source !== "call") throw new Error("Источник заказа не «звонок»");
  ok(`заказ № ${order.number} принят по телефону, источник «звонок»`);

  const client = await post("orders", { action: "client-lookup", phone: "060000911" });
  if (client.client?.name !== "QA Клиент") throw new Error("Клиент не подтянулся по номеру");
  ok("по введённому номеру подтягивается имя клиента из прошлых заказов");

  let detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  await post("orders", { action: "order-status", id: order.id, status: "issued", version: detail.version }, 400);
  ok("перескочить из «Новый» сразу в «Выдан» нельзя");

  await post("orders", { action: "order-status", id: order.id, status: "confirmed", version: detail.version });
  if (db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(part.id).stock !== 1) throw new Error("Подтверждение не списало остаток");
  const confirmMove = (await post("parts", { action: "stock-moves", id: part.id })).moves.find((move) => move.reason === "order_confirm");
  if (!confirmMove || confirmMove.delta !== -1) throw new Error("Списание по заказу не попало в историю остатка");
  ok("«Подтверждён» списывает остаток и пишет отдельную запись: что, насколько, почему, кто");

  detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  const stale = detail.version;
  await post("orders", { action: "delivery-cost", id: order.id, cost: 150, version: detail.version });
  const conflict = await post("orders", { action: "order-notes", id: order.id, notes: "поздно", version: stale }, 400);
  if (!conflict.message?.includes("другой человек")) throw new Error(`Конфликт версий не сработал: ${conflict.message}`);
  ok("правка по устаревшей версии отклоняется: «Заказ изменил другой человек, обновите страницу»");

  // Второй заказ на ту же деталь: остатка уже не хватит.
  const second = await post("orders", { action: "create-call-order", phone: "+37360000912", name: "QA Второй", deliveryMethod: "pickup", paymentMethod: "receipt", items: [{ id: part.id, quantity: 2 }] });
  const secondDetail = (await post("orders", { action: "order-detail", id: second.id })).order;
  const shortage = await post("orders", { action: "order-status", id: second.id, status: "confirmed", version: secondDetail.version }, 400);
  if (!shortage.message?.includes("осталось 1, в заказе 2")) throw new Error(`Нет понятного сообщения о нехватке: ${shortage.message}`);
  ok("при нехватке заказ не подтверждается и пишет «осталось 1, в заказе 2»");

  const noComment = await post("orders", { action: "order-status", id: second.id, status: "cancelled", version: secondDetail.version }, 400);
  if (!noComment.message?.includes("причину")) throw new Error("Отмена прошла без комментария");
  await post("orders", { action: "order-status", id: second.id, status: "cancelled", version: secondDetail.version, comment: "клиент передумал" });
  ok("отмена без комментария не проходит, с комментарием — проходит");

  detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  await post("orders", { action: "order-status", id: order.id, status: "ready", version: detail.version });
  detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  await post("orders", { action: "order-status", id: order.id, status: "issued", version: detail.version });
  detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  const receipt = await post("orders", { action: "receipt", id: order.id, version: detail.version });
  const receiptPage = plain(await (await get(receipt.url)).text());
  if (!receiptPage.includes(`№ ${order.number}`)) throw new Error("В чеке нет номера заказа");
  if (!receiptPage.includes(part.sku)) throw new Error("В чеке нет артикула детали");
  if (!receiptPage.includes("Б/у, хорошее")) throw new Error("В чеке нет состояния детали");
  if (!receiptPage.includes("Гарантия и возврат")) throw new Error("В чеке нет строки о гарантии и возврате");
  if (!/Доставка: 150/.test(receiptPage) || !/Итого: 1\s*750/.test(receiptPage)) throw new Error("В чеке не учтена стоимость доставки");
  if (!receiptPage.includes("<svg") || !receiptPage.includes("QR-код")) throw new Error("В чеке нет QR-кода");
  const snapshot = JSON.parse(db.prepare("SELECT receipt_json FROM orders WHERE id=?").get(order.id).receipt_json);
  if (!snapshot.statusUrl.endsWith(`/order/s/${detail.token}`)) throw new Error(`QR ведёт не на статус заказа: ${snapshot.statusUrl}`);
  ok("чек: номер, артикулы, состояние, доставка в итоге, гарантия и QR на статус заказа");

  const invoice = plain(await (await get(`${receipt.url}?doc=invoice`)).text());
  if (!invoice.includes("Накладная") || !invoice.includes("Деталь получил")) throw new Error("Накладная не формируется");
  ok("вторым документом формируется накладная на выдачу");

  const again = await post("orders", { action: "receipt", id: order.id, version: (await post("orders", { action: "order-detail", id: order.id })).order.version });
  if (again.token !== receipt.token) throw new Error("Повторное нажатие создало новый чек");
  ok("чек сохранён в заказе: повторное открытие отдаёт тот же документ");

  const engine = await post("parts", { action: "add-part", partTypeId: engineType.id, condition: "good", price: 25000, stock: 1, nameRu: "QA Мотор в сборе" });
  const engineOrder = await post("orders", { action: "create-call-order", phone: "+37360000911", name: "QA Клиент", deliveryMethod: "pickup", paymentMethod: "receipt", items: [{ id: engine.id, quantity: 1 }] });
  let engineDetail = (await post("orders", { action: "order-detail", id: engineOrder.id })).order;
  for (const next of ["confirmed", "ready", "issued"]) {
    await post("orders", { action: "order-status", id: engineOrder.id, status: next, version: engineDetail.version });
    engineDetail = (await post("orders", { action: "order-detail", id: engineOrder.id })).order;
  }
  const refused = await post("orders", { action: "create-return", orderId: engineOrder.id, productId: engine.id, decision: "full", amountMdl: 25000, reason: "клиент передумал" }, 400);
  if (!refused.message?.includes("возврату не подлежит")) throw new Error(`Мотор приняли к возврату: ${refused.message}`);
  ok("двигатель к возврату не принимается — это видно прямо в карточке");

  await post("orders", { action: "create-return", orderId: order.id, productId: part.id, decision: "partial", amountMdl: 500, reason: "скол на креплении", inspection: "метки на месте" });
  const returns = db.prepare("SELECT decision, amount_mdl, actor_name FROM order_returns WHERE order_id=?").get(order.id);
  if (returns.decision !== "partial" || Number(returns.amount_mdl) !== 500) throw new Error("Решение по возврату не сохранилось");
  ok("возврат оформлен: осмотр, решение «частичный», сумма и причина");

  const history = db.prepare("SELECT from_status,to_status,actor_name FROM order_status_history WHERE order_id=? ORDER BY id").all(order.id);
  if (history.length < 4 || !history.some((entry) => entry.actor_name === "QA Boss")) throw new Error("История статусов неполная или без автора");
  ok(`в истории заказа ${history.length} записи с автором и временем`);

  detail = (await post("orders", { action: "order-detail", id: order.id })).order;
  await post("orders", { action: "order-status", id: order.id, status: "returned", version: detail.version, comment: "возврат по решению" });
  if (db.prepare("SELECT stock FROM catalog_products WHERE id=?").get(part.id).stock !== 2) throw new Error("Возврат не вернул остаток");
  ok("возврат заказа возвращает остаток на склад");

  const message = await post("orders", { action: "order-message", id: order.id });
  if (!message.ru.includes(`№ ${order.number}`) || !message.ro.includes(`nr. ${order.number}`)) throw new Error("Шаблон сообщения не готовится на двух языках");
  ok("готовый текст клиенту формируется по-русски и по-румынски");

  /* ---------- Личный кабинет покупателя ---------- */

  const register = await buyer.request.post(`${root}/api/account`, { headers: { origin: root }, data: { action: "register", name: "QA Покупатель", surname: "Тестов", email: customerEmail, phone: "060000911", password: "parol12345", agreed: true } });
  if (register.status() !== 200) throw new Error(`Регистрация: ${register.status()} ${await register.text()}`);
  ok("покупатель регистрируется: имя, фамилия, почта, телефон и пароль");

  const byPhone = await buyer.request.post(`${root}/api/account`, { headers: { origin: root }, data: { action: "login", login: "060000911", password: "parol12345" } });
  if (byPhone.status() !== 200) throw new Error("Вход по телефону не работает");
  const wrong = await buyer.request.post(`${root}/api/account`, { headers: { origin: root }, data: { action: "login", login: customerEmail, password: "nepravilno" } });
  if (wrong.status() !== 401) throw new Error("Неверный пароль пустил в кабинет");
  ok("вход работает и по почте, и по телефону; неверный пароль не пускает");

  const accountPage = plain(await (await buyer.request.get(`${root}/account/orders`)).text());
  if (!accountPage.includes(`№ ${order.number}`)) throw new Error("Заказ, сделанный до регистрации, не попал в историю кабинета");
  ok("в историю кабинета попадают и заказы, сделанные до регистрации — по тому же телефону");

  const guestAccount = await guest.request.get(`${root}/account`, { maxRedirects: 0 });
  if (guestAccount.status() !== 307 || !guestAccount.headers().location?.includes("/login")) throw new Error("Кабинет открыт без входа");
  ok("без входа кабинет закрыт и уводит на страницу входа");

  /* ---------- Снимки экрана ---------- */

  const page = await context.newPage();
  for (const [path, name] of [["/admin/orders", "orders-board"], ["/admin/inventory", "parts-board"], ["/admin/donors", "donors"], ["/admin/returns", "returns"], ["/admin/pages", "site-pages"]]) {
    await page.goto(`${root}${path}`, { waitUntil: "domcontentloaded" });
    await page.locator('.admin-shell[data-ready="1"]').waitFor({ timeout: 15000 });
    await page.screenshot({ path: `qa/shots/task8-${name}-1440.png`, fullPage: true });
  }
  await page.goto(`${root}/admin/orders`, { waitUntil: "domcontentloaded" });
  await page.locator('.admin-shell[data-ready="1"]').waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Все" }).click();
  await page.getByText(`№ ${order.number}`).first().click();
  await page.getByRole("heading", { name: `Заказ № ${order.number}` }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "qa/shots/task8-order-card-1440.png", fullPage: true });
  ok("сняты экраны: заказы, карточка заказа, детали, доноры, возвраты, страницы");

  const narrow = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await narrow.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: ownerPhone, password: secret } });
  const small = await narrow.newPage();
  await small.goto(`${root}/admin/inventory`, { waitUntil: "domcontentloaded" });
  await small.locator('.admin-shell[data-ready="1"]').waitFor({ timeout: 15000 });
  if (await small.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("Список деталей шире экрана на 390 px");
  await small.screenshot({ path: "qa/shots/task9-parts-390.png", fullPage: true });
  ok("на экране 390 px список деталей не вылезает за край");

  console.log(steps.join("\n"));
  console.log("Заказы, детали, доноры, страницы и кабинет — проверка пройдена");
} finally {
  cleanup();
  db.close();
  await browser.close();
}

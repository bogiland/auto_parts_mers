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
const ownerPhone = "+37377776311", operatorPhone = "+37377776312";
const created = { categories: [], types: [], makes: [], brands: [], parts: [], files: [] };
const browser = await chromium.launch({ channel: "chrome" });
const steps = [];
// Вход повторяется: в dev-режиме Next отдаёт 500, если запрос попал в пересборку.
async function signIn(target, phone) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await target.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone, password: secret } });
    if (response.status() === 200) return true;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}
const ok = (message) => { steps.push(`  ok  ${message}`); };

function cleanup() {
  const qaCategories = "SELECT id FROM ref_categories WHERE name_ru LIKE 'QA %'";
  db.prepare("DELETE FROM catalog_products WHERE name LIKE 'QA %'").run();
  db.prepare("DELETE FROM ref_brands WHERE name LIKE 'QA %'").run();
  for (const row of db.prepare("SELECT id FROM ref_makes WHERE name LIKE 'QA %'").all()) {
    db.prepare("DELETE FROM ref_generations WHERE model_id IN (SELECT id FROM ref_models WHERE make_id=?)").run(row.id);
    db.prepare("DELETE FROM ref_models WHERE make_id=?").run(row.id);
    db.prepare("DELETE FROM ref_makes WHERE id=?").run(row.id);
  }
  db.prepare("DELETE FROM ref_part_types WHERE name_ru LIKE 'QA %'").run();
  db.prepare(`UPDATE catalog_products SET category_id=NULL WHERE category_id IN (${qaCategories})`).run();
  db.prepare(`DELETE FROM ref_category_redirects WHERE category_id IN (${qaCategories})`).run();
  // Листья удаляются первыми, иначе ссылка «родитель → потомок» не даст убрать ветку.
  for (let pass = 0; pass < 5; pass += 1) db.prepare("DELETE FROM ref_categories WHERE name_ru LIKE 'QA %' AND id NOT IN (SELECT parent_id FROM ref_categories WHERE parent_id IS NOT NULL)").run();
  for (const file of created.files) { try { unlinkSync(join("public", file.replace(/^\//, ""))); } catch { /* файл мог быть уже убран */ } }
  for (const row of db.prepare("SELECT id FROM staff_users WHERE phone IN (?,?)").all(ownerPhone, operatorPhone)) db.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(row.id);
  db.prepare("DELETE FROM staff_users WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  db.prepare("DELETE FROM staff_audit WHERE actor_name IN ('QA Ref Owner','QA Ref Operator')").run();
}

try {
  cleanup();
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'owner')").run("QA Ref Owner", ownerPhone, passwordHash);
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'operator')").run("QA Ref Operator", operatorPhone, passwordHash);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await context.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: ownerPhone, password: secret } });
  if (login.status() !== 200) throw new Error(`Вход владельца: ${login.status()}`);
  // В dev-режиме Next отдаёт 500, если запрос попал в момент пересборки манифеста, поэтому один повтор.
  const call = async (data, expected = 200) => {
    let response = await context.request.post(`${root}/api/staff/reference`, { headers: { origin: root }, data });
    if (response.status() === 500 && expected !== 500) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      response = await context.request.post(`${root}/api/staff/reference`, { headers: { origin: root }, data });
    }
    if (response.status() !== expected) throw new Error(`${data.action}: ожидали ${expected}, получили ${response.status()} ${await response.text()}`);
    return response.status() === 200 ? response.json() : response.text();
  };
  const action = async (data, expected = 200) => {
    let response = await context.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data });
    if (response.status() === 500 && expected !== 500) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      response = await context.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data });
    }
    if (response.status() !== expected) throw new Error(`${data.action}: ожидали ${expected}, получили ${response.status()} ${await response.text()}`);
    return response;
  };

  // 1. Категории: создание, вложенность, счётчики
  const parent = await call({ action: "save-category", nameRu: "QA Тормозная система", nameRo: "QA Sistem de frânare", intro: "Проверочная категория QA.", seoTitle: "QA тормоза — NAA.md", visible: true });
  created.categories.push(parent.id);
  const child = await call({ action: "save-category", nameRu: "QA Колодки", parentId: parent.id, visible: true });
  created.categories.push(child.id);
  const grand = await call({ action: "save-category", nameRu: "QA Передние", parentId: child.id, visible: true });
  created.categories.push(grand.id);
  const parentSlug = db.prepare("SELECT slug FROM ref_categories WHERE id=?").get(parent.id).slug;
  if (parentSlug !== "qa-tormoznaya-sistema") throw new Error(`Адрес собрался неверно: ${parentSlug}`);
  ok(`три уровня категорий созданы, адрес транслитерирован: /${parentSlug}`);

  // 2. Четвёртый уровень запрещён
  await call({ action: "save-category", nameRu: "QA Слишком глубоко", parentId: grand.id, visible: true }, 400);
  ok("четвёртый уровень вложенности отклонён");

  // 3. Тип детали и сборка названия
  const type = await call({ action: "save-part-type", nameRu: "QA Фара", nameRo: "QA Far", categoryId: parent.id, hasSide: true, hasPosition: false, returnRestricted: false });
  created.types.push(type.id);
  const engineType = await call({ action: "save-part-type", nameRu: "QA Двигатель", categoryId: parent.id, assembly: true, assemblyIncludes: "навесное, стартер", returnRestricted: true });
  created.types.push(engineType.id);
  ok("типы деталей заведены, у двигателя стоит запрет возврата");

  // 4. Деталь из справочника получает собранное имя и категорию
  await action({ action: "add-product", partTypeId: type.id, side: "left", price: 500, stock: 2 });
  const part = db.prepare("SELECT id,name,category_id,part_type_id,return_restricted FROM catalog_products WHERE name=?").get("QA Фара левая");
  if (!part) throw new Error("Деталь с собранным названием не найдена");
  created.parts.push(part.id);
  if (part.category_id !== parent.id) throw new Error("Деталь не встала в категорию типа");
  ok(`деталь названа «${part.name}» и встала в категорию типа`);

  await action({ action: "add-product", partTypeId: type.id, price: 100, stock: 1 }, 400);
  ok("деталь без обязательной стороны отклонена");

  await action({ action: "add-product", partTypeId: engineType.id, price: 25000, stock: 1 });
  const engineRow = db.prepare("SELECT id,return_restricted FROM catalog_products WHERE name='QA Двигатель'").get();
  created.parts.push(engineRow.id);
  if (engineRow.return_restricted !== 1) throw new Error("Запрет возврата не перешёл из типа в деталь");
  ok("деталь типа «Двигатель» получила запрет возврата из справочника");

  // 5. Категория видна на сайте
  const publicPage = await context.newPage();
  const visible = await publicPage.goto(`${root}/catalog/legkovye/${parentSlug}`);
  if (visible?.status() !== 200) throw new Error(`Страница категории: ${visible?.status()}`);
  await publicPage.getByText("Проверочная категория QA.").waitFor({ timeout: 15000 });
  const headings = await publicPage.locator("h1").count();
  const mains = await publicPage.locator("main").count();
  if (headings !== 1 || mains !== 1) throw new Error(`На странице категории ${headings} h1 и ${mains} main, должно быть по одному`);
  ok("категория открывается на сайте, показывает свой текст, один h1 и один main");
  const menu = await publicPage.goto(`${root}/`);
  if (menu?.status() !== 200) throw new Error("Главная не открылась");
  if (!(await publicPage.getByText("QA Тормозная система").count())) throw new Error("Новая категория не появилась на главной");
  ok("новая категория сразу встала на главную");

  // 6. Счётчики в админке
  const adminPage = await context.newPage();
  const clientProblems = [];
  // Переход повторяется: dev-сервер иногда обрывает навигацию во время пересборки.
  const openAdmin = async (url, heading) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await adminPage.keyboard.press("Escape");
        await adminPage.goto(`${root}${url}`, { waitUntil: "domcontentloaded" });
        await adminPage.getByRole("heading", { name: heading }).waitFor({ timeout: 20000 });
        await adminPage.locator('.admin-shell[data-ready="1"]').waitFor({ timeout: 20000 });
        return;
      } catch (reason) {
        if (attempt === 3) throw reason;
        await adminPage.waitForTimeout(2500);
      }
    }
  };
  adminPage.on("pageerror", (error) => clientProblems.push(error.message.slice(0, 200)));
  adminPage.on("console", (message) => { if (message.type() === "error") clientProblems.push(message.text().slice(0, 200)); });
  await openAdmin("/admin/reference?tab=categories", "Категории каталога");
  await adminPage.getByText("QA Тормозная система").first().waitFor();
  const counter = await adminPage.locator(".admin-tree-row", { hasText: "QA Тормозная система" }).first().locator(".admin-tree-count").innerText();
  if (!counter.includes("2 дет.")) throw new Error(`Счётчик деталей показал «${counter}»`);
  ok(`в дереве виден счёт деталей: «${counter}»`);
  await adminPage.screenshot({ path: "qa/shots/reference-categories-1440.png", fullPage: true });

  // 7. Скрытая категория
  await call({ action: "save-category", id: parent.id, nameRu: "QA Тормозная система", slug: parentSlug, intro: "Проверочная категория QA.", visible: false });
  const hidden = await publicPage.goto(`${root}/catalog/legkovye/${parentSlug}`);
  if (hidden?.status() !== 200) throw new Error(`Скрытая категория вернула ${hidden?.status()}, а должна отдавать страницу-заглушку`);
  await publicPage.getByRole("heading", { name: "Раздел временно недоступен" }).waitFor({ timeout: 15000 });
  await publicPage.screenshot({ path: "qa/shots/reference-hidden-category-1440.png" });
  const home = await publicPage.goto(`${root}/`);
  if (home?.status() !== 200) throw new Error("Главная не открылась");
  if (await publicPage.getByText("QA Тормозная система").count()) throw new Error("Скрытая категория осталась на главной");
  ok("скрытая категория исчезла с главной, но её страница отдаёт «раздел временно недоступен»");
  await call({ action: "save-category", id: parent.id, nameRu: "QA Тормозная система", slug: parentSlug, intro: "Проверочная категория QA.", visible: true });

  // 8. Переадресация со старого адреса
  await call({ action: "save-category", id: parent.id, nameRu: "QA Тормозная система", slug: "qa-tormoza-novyy", intro: "Проверочная категория QA.", visible: true });
  const redirect = await context.request.get(`${root}/catalog/legkovye/${parentSlug}`, { maxRedirects: 0 });
  if (![301, 308].includes(redirect.status())) throw new Error(`Старый адрес вернул ${redirect.status()} вместо переадресации`);
  const location = redirect.headers().location ?? "";
  if (!location.includes("qa-tormoza-novyy")) throw new Error(`Переадресация ведёт не туда: ${location}`);
  ok(`со старого адреса стоит переадресация ${redirect.status()} → ${location}`);

  // 9. Удаление категории с деталями
  await call({ action: "delete-category", id: parent.id }, 400);
  ok("категорию с деталями не дали удалить без переноса");
  await call({ action: "delete-category", id: grand.id });
  created.categories = created.categories.filter((id) => id !== grand.id);
  const spare = await call({ action: "save-category", nameRu: "QA Запасная", visible: true });
  created.categories.push(spare.id);
  await call({ action: "delete-category", id: child.id });
  created.categories = created.categories.filter((id) => id !== child.id);
  await call({ action: "delete-category", id: parent.id, moveTo: spare.id });
  created.categories = created.categories.filter((id) => id !== parent.id);
  const moved = db.prepare("SELECT COUNT(*) AS count FROM catalog_products WHERE category_id=?").get(spare.id).count;
  if (moved !== 2) throw new Error(`После переноса в запасной категории ${moved} дет., ожидали 2`);
  ok("при удалении категории детали перенесены в выбранную");

  // 10. Марки, модели, поколения и бренды
  const make = await call({ action: "save-make", name: "QA Mercedes" });
  created.makes.push(make.id);
  const model = await call({ action: "save-model", makeId: make.id, name: "QA W212" });
  await call({ action: "save-generation", modelId: model.id, name: "QA рестайлинг", yearFrom: 2013, yearTo: 2016, engines: "OM651 2.2d" });
  await call({ action: "save-generation", modelId: model.id, name: "QA кривые годы", yearFrom: 2016, yearTo: 2013 }, 400);
  const brand = await call({ action: "save-brand", name: "QA Bosch", description: "Проверочный бренд." });
  created.brands.push(brand.id);
  ok("марка, модель, поколение и бренд заведены, перевёрнутые годы отклонены");

  for (const tab of ["types", "vehicles", "brands"]) {
    await openAdmin(`/admin/reference?tab=${tab}`, "Справочники");
    await adminPage.locator(".admin-tabs .is-active").waitFor();
    await adminPage.screenshot({ path: `qa/shots/reference-${tab}-1440.png`, fullPage: true });
  }
  ok("вкладки справочника открываются, снимки сохранены");

  // 11. Обрезка картинки прямо в браузере
  await openAdmin("/admin/reference?tab=brands", "Бренды");
  await adminPage.locator(".admin-sub-card").first().waitFor();
  await adminPage.getByRole("button", { name: "Изменить" }).first().click();
  await adminPage.getByRole("dialog", { name: "Бренд" }).waitFor();
  await adminPage.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400; canvas.height = 900;
    const context = canvas.getContext("2d");
    context.fillStyle = "#df1420"; context.fillRect(0, 0, 1400, 900);
    context.fillStyle = "#ffffff"; context.fillRect(200, 150, 400, 300);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "qa-logo.png", { type: "image/png" }));
    const input = document.querySelector('.admin-image-field input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await adminPage.getByRole("dialog", { name: "Обрезка картинки" }).waitFor({ timeout: 10000 });
  await adminPage.getByText("Для этого места нужно 240 × 120 точек").waitFor();
  await adminPage.screenshot({ path: "qa/shots/reference-crop-1440.png" });
  await adminPage.getByRole("button", { name: "Готово" }).click();
  await adminPage.locator(".admin-image-shot").waitFor({ timeout: 10000 });
  await adminPage.getByRole("dialog", { name: "Бренд" }).getByRole("button", { name: "Сохранить" }).click();
  await adminPage.getByText("Бренд сохранён").waitFor({ timeout: 10000 });
  const logo = db.prepare("SELECT logo FROM ref_brands WHERE id=?").get(brand.id).logo;
  if (!/^\/uploads\/[a-f0-9]{32}\.webp$/.test(logo)) throw new Error(`Логотип сохранён как «${logo}», ожидали файл WebP в /uploads`);
  created.files.push(logo);
  ok(`картинка обрезана в браузере и сохранена как ${logo}`);

  // 12. Мелкая картинка предупреждает
  await adminPage.getByRole("button", { name: "Изменить" }).first().click();
  await adminPage.getByRole("dialog", { name: "Бренд" }).waitFor({ timeout: 15000 });
  await adminPage.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80; canvas.height = 40;
    canvas.getContext("2d").fillRect(0, 0, 80, 40);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "small.png", { type: "image/png" }));
    const input = document.querySelector('.admin-image-field input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await adminPage.getByText("Картинка мелкая, на большом экране будет размытой").waitFor({ timeout: 10000 });
  ok("мелкая картинка вызывает предупреждение с выбором «всё равно поставить»");

  // 13. Форма детали собирает название из справочника
  const typeForForm = await call({ action: "save-part-type", nameRu: "QA Дверь", hasSide: true, hasPosition: true });
  const placeForForm = await call({ action: "save-category", nameRu: "QA Кузов", visible: true });
  await openAdmin("/admin/inventory?new=1", "Детали");
  await adminPage.getByText("+ Добавить деталь").waitFor();
  await adminPage.getByLabel("Тип детали").waitFor();
  await adminPage.waitForLoadState("networkidle");
  // Выбор повторяется: пока страница не ожила, React сбрасывает значение, выставленное прямо в DOM.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await adminPage.getByLabel("Тип детали").selectOption({ label: "QA Дверь" });
    if (await adminPage.getByLabel("Сторона").count()) break;
    if (attempt === 11) throw new Error(`Форма склада не ожила. Ошибки в браузере: ${clientProblems.join(" // ") || "нет"}`);
    await adminPage.waitForTimeout(2000);
  }
  await adminPage.getByLabel("Сторона").selectOption("left");
  await adminPage.getByLabel("Положение").selectOption("rear");
  await adminPage.getByLabel("Категория каталога").selectOption(placeForForm.id);
  await adminPage.getByLabel("Цена MDL").fill("1500");
  await adminPage.getByLabel("Остаток").fill("1");
  await adminPage.getByText("В каталоге деталь будет называться:").waitFor();
  const previewName = await adminPage.locator(".admin-note", { hasText: "В каталоге деталь будет называться" }).innerText();
  if (!previewName.includes("QA Дверь левая задняя")) throw new Error(`Предпросмотр названия показал «${previewName}»`);
  await adminPage.screenshot({ path: "qa/shots/reference-add-part-1440.png", fullPage: true });
  await adminPage.getByRole("button", { name: "Добавить" }).click();
  await adminPage.getByText("добавлена в категорию «QA Кузов»").waitFor({ timeout: 15000 });
  const formPart = db.prepare("SELECT id,category_id,part_type_id FROM catalog_products WHERE name='QA Дверь левая задняя'").get();
  if (!formPart) throw new Error("Деталь из формы не сохранилась");
  if (formPart.category_id !== placeForForm.id || formPart.part_type_id !== typeForForm.id) throw new Error("Деталь из формы не связалась со справочником");
  ok("форма склада собрала название «QA Дверь левая задняя» и поставила деталь в выбранную категорию");

  // 14. Телефонный экран
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (!(await signIn(mobile, ownerPhone))) throw new Error("Вход с телефона не прошёл");
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${root}/admin/reference?tab=categories`);
  await mobilePage.getByRole("heading", { name: "Категории каталога" }).waitFor();
  await mobilePage.screenshot({ path: "qa/shots/reference-categories-390.png", fullPage: true });
  ok("справочник открывается на экране 390 px");
  await mobile.close();

  // 15. Оператору справочники закрыты
  const operator = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (!(await signIn(operator, operatorPhone))) throw new Error("Вход оператора не прошёл");
  const operatorPage = await operator.newPage();
  const forbidden = await operatorPage.goto(`${root}/admin/reference`);
  if (forbidden?.status() !== 404) throw new Error(`Оператор получил ${forbidden?.status()} вместо 404`);
  const writeAttempt = await operator.request.post(`${root}/api/staff/reference`, { headers: { origin: root }, data: { action: "save-brand", name: "QA Оператор" } });
  if (writeAttempt.status() !== 403) throw new Error(`Оператор смог обратиться к справочнику: ${writeAttempt.status()}`);
  if (db.prepare("SELECT id FROM ref_brands WHERE name='QA Оператор'").get()) throw new Error("Оператор записал бренд");
  ok("оператор не видит справочники и не может в них писать");
  await operator.close();

  console.log(`\nСправочники и загрузка картинок — проверка пройдена\n${steps.join("\n")}\n`);
} catch (error) {
  console.error(`\nПроверка не прошла: ${error.message}\n${steps.join("\n")}\n`);
  process.exitCode = 1;
} finally {
  cleanup();
  await browser.close();
  db.close();
}

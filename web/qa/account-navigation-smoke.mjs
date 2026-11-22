// Кабинет покупателя: проверки полей, вход и регистрация без ручной перезагрузки,
// переходы по вкладкам и выход. Гоняется по живому приложению на localhost:3000.
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const root = "http://localhost:3000";
const email = "qa-navigation@naa.test";
const phone = "060111223";
const password = "qa-navigation-2026";
const db = new DatabaseSync("data/orders.sqlite");
const browser = await chromium.launch({ channel: "chrome" });
const steps = [];
const ok = (message) => steps.push(`  ok  ${message}`);

function cleanup() {
  for (const row of db.prepare("SELECT id FROM customers WHERE email IN (?,?)").all(email, "qa-busy@naa.test")) {
    db.prepare("DELETE FROM customer_sessions WHERE customer_id=?").run(row.id);
    db.prepare("DELETE FROM customer_addresses WHERE customer_id=?").run(row.id);
    db.prepare("DELETE FROM customers WHERE id=?").run(row.id);
  }
  db.prepare("DELETE FROM customer_attempts WHERE login LIKE 'qa-%'").run();
}

const accounts = () => Number(db.prepare("SELECT COUNT(*) AS n FROM customers WHERE email=?").get(email).n);

try {
  cleanup();
  const page = await browser.newPage();
  // Кнопка включается только после гидратации: иначе браузер отправит форму сам и пароль уйдёт в адрес.
  const enabled = (text) => page.waitForFunction((wanted) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(wanted));
    return Boolean(button) && !button.disabled;
  }, text, { timeout: 30000 });
  const fieldError = (name) => page.locator(`#${name}`).locator("xpath=following-sibling::p[@role='alert']").first();

  /* ---------- Проверки полей регистрации ---------- */

  await page.goto(`${root}/register`);
  const register = page.getByRole("button", { name: "Зарегистрироваться" });
  await register.waitFor();
  if (!(await register.isDisabled())) throw new Error("Кнопка регистрации активна до гидратации");
  await enabled("Зарегистрироваться");
  ok("до гидратации кнопка регистрации выключена — форма не уйдёт обычным GET с паролем в адресе");

  await register.click();
  await fieldError("reg-name").waitFor({ timeout: 10000 });
  if (!(await fieldError("reg-email").isVisible())) throw new Error("Пустая почта прошла проверку");
  if (!(await page.getByText("Проверьте номер телефона.").first().isVisible())) throw new Error("Пустой телефон прошёл проверку");
  if (accounts() !== 0) throw new Error("Пустая форма создала кабинет");
  ok("пустая форма не отправляется: ошибки встают под именем, почтой, телефоном и паролем");

  await page.locator("#reg-name").fill("QA");
  await page.locator("#reg-surname").fill("Navigation");
  await page.locator("#reg-email").fill("почта-без-собаки");
  await page.getByLabel("Номер телефона").fill("123");
  await page.locator("#reg-password").fill("korotko");
  await page.locator("#reg-repeat").fill("drugoe");
  await register.click();
  await page.waitForTimeout(500);
  if (!(await fieldError("reg-email").isVisible())) throw new Error("Почта без собаки прошла проверку");
  if (!(await fieldError("reg-password").isVisible())) throw new Error("Короткий пароль прошёл проверку");
  if (!(await fieldError("reg-repeat").isVisible())) throw new Error("Разные пароли прошли проверку");
  if (!(await page.getByText("Проверьте номер телефона.").first().isVisible())) throw new Error("Негодный номер прошёл проверку");
  if (accounts() !== 0) throw new Error("Форма с ошибками создала кабинет");
  ok("почта без «@», короткий пароль, разные пароли и негодный номер не проходят");

  await page.locator("#reg-email").fill(email);
  await page.getByLabel("Номер телефона").fill(phone);
  await page.locator("#reg-password").fill(password);
  await page.locator("#reg-repeat").fill(password);
  await register.click();
  await page.waitForTimeout(500);
  if (!(await page.getByText("Без согласия на обработку данных").first().isVisible())) throw new Error("Кабинет создаётся без согласия на обработку данных");
  if (accounts() !== 0) throw new Error("Кабинет создан без согласия");
  ok("без галочки согласия кабинет не создаётся");

  /* ---------- Регистрация и переход в кабинет ---------- */

  await page.locator('[name="agreed"]').check();
  await register.click();
  await page.waitForURL("**/account", { timeout: 30000 });
  await page.getByRole("heading", { name: "Мой кабинет" }).waitFor({ timeout: 30000 });
  const stored = db.prepare("SELECT phone FROM customers WHERE email=?").get(email);
  if (stored.phone !== "+37360111223") throw new Error(`Телефон сохранён как ${stored.phone}`);
  ok("регистрация сразу открывает кабинет, номер 060 111 223 сохранён как +37360111223");

  if (!(await page.locator("header").getByText("QA").first().isVisible())) throw new Error("Шапка не показала имя вошедшего");
  ok("в шапке сразу появляется имя — перезагружать страницу не нужно");

  /* ---------- Вкладки кабинета ---------- */

  for (const [link, heading, target] of [
    ["Редактировать информацию об учётной записи", "Информация о моём аккаунте", "/account/edit"],
    ["Мои адреса", "Мои адреса", "/account/addresses"],
    ["Изменить пароль", "Изменить пароль", "/account/password"],
    ["История заказов", "История заказов", "/account/orders"],
  ]) {
    await page.getByRole("link", { name: link }).click();
    await page.waitForURL(`**${target}`, { timeout: 30000 });
    await page.getByRole("heading", { name: heading, level: 1 }).waitFor({ timeout: 30000 });
  }
  ok("вкладки кабинета открываются: данные, адреса, пароль, история заказов");

  /* ---------- Проверки в кабинете ---------- */

  await page.goto(`${root}/account/addresses`);
  await page.getByRole("heading", { name: "Мои адреса", level: 1 }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Добавить адрес" }).click();
  await page.getByRole("button", { name: "Сохранить адрес" }).click();
  await fieldError("addr-city").waitFor({ timeout: 10000 });
  if (!(await fieldError("addr-street").isVisible())) throw new Error("Пустая улица прошла проверку");
  await page.locator("#addr-city").fill("Слободзея");
  await page.locator("#addr-street").fill("ул. Новосовицкая 25");
  await page.getByRole("button", { name: "Сохранить адрес" }).click();
  await page.getByText("Слободзея, ул. Новосовицкая 25").first().waitFor({ timeout: 30000 });
  ok("адрес без города и улицы не сохраняется, заполненный — сохраняется и виден в списке");

  await page.goto(`${root}/account/edit`);
  await page.getByRole("heading", { name: "Информация о моём аккаунте", level: 1 }).waitFor({ timeout: 30000 });
  await page.locator("#profile-email").fill("опять-без-собаки");
  await page.getByRole("button", { name: "Продолжать" }).click();
  await fieldError("profile-email").waitFor({ timeout: 10000 });
  if (db.prepare("SELECT email FROM customers WHERE email=?").get(email) === undefined) throw new Error("Негодная почта перезаписала рабочую");
  ok("в личных данных негодная почта не сохраняется");

  await page.goto(`${root}/account/password`);
  await page.getByRole("heading", { name: "Изменить пароль", level: 1 }).waitFor({ timeout: 30000 });
  await page.locator("#pass-current").fill(password);
  await page.locator("#pass-new").fill("korotko");
  await page.locator("#pass-repeat").fill("korotko");
  await page.getByRole("button", { name: "Сменить пароль" }).click();
  await fieldError("pass-new").waitFor({ timeout: 10000 });
  ok("короткий новый пароль не принимается");

  /* ---------- Выход и вход ---------- */

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.waitForURL(root + "/", { timeout: 30000 });
  if (!(await page.locator("header").getByText("Войти").first().isVisible())) throw new Error("После выхода в шапке осталось имя");
  ok("выход возвращает на главную, в шапке снова «Войти»");

  await page.goto(`${root}/login`);
  const login = page.getByRole("button", { name: "Войти", exact: true });
  await enabled("Войти");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await fieldError("login-login").waitFor({ timeout: 10000 });
  if (!(await fieldError("login-password").isVisible())) throw new Error("Пустой пароль прошёл проверку");
  ok("вход с пустыми полями не отправляется");

  await page.locator("#login-login").fill(email);
  await page.locator("#login-password").fill("nepravilnyj-parol");
  await login.click();
  await page.getByText("Неверная почта, телефон или пароль.").first().waitFor({ timeout: 15000 });
  ok("неверный пароль не пускает и не говорит, есть ли такая почта");

  await page.locator("#login-login").fill(phone);
  await page.locator("#login-password").fill(password);
  await login.click();
  await page.waitForURL("**/account", { timeout: 30000 });
  await page.getByRole("heading", { name: "Мой кабинет" }).waitFor({ timeout: 30000 });
  ok("вход по короткому номеру 060 111 223 сразу открывает кабинет");

  await page.screenshot({ path: "qa/shots/account-cabinet-1280.png", fullPage: true });
  console.log(steps.join("\n"));
  console.log("Кабинет покупателя — проверка пройдена");
} finally {
  cleanup();
  db.close();
  await browser.close();
}

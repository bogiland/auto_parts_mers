import { chromium } from "playwright";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
const ownerPhone = "+37377777001";
const operatorPhone = "+37377777002";
const password = `temporary-${randomBytes(12).toString("hex")}`;
let db;
let orderId;
try {
  const setup = await browser.newContext();
  await setup.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: "+37300000000", password: "wrong" } });
  await setup.close();
  db = new DatabaseSync("data/orders.sqlite");
  const salt = randomBytes(16);
  const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'owner')").run("Тест Owner", ownerPhone, hash);
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'operator')").run("Тест Operator", operatorPhone, hash);
  const token = randomBytes(32).toString("hex");
  const result = db.prepare("INSERT INTO orders(idempotency_key,token,name,phone,contact_method,delivery_method,delivery_title,address,payment_method,payment_title,comment,total_mdl,total_rub,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(token, token, "Тест Клиент", "+37377123445", "call", "pickup", "Самовывоз", "", "receipt", "При получении", "", 100, null, new Date().toISOString());
  orderId = Number(result.lastInsertRowid);

  const operator = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const operatorPage = await operator.newPage();
  const login = await operatorPage.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: operatorPhone, password } });
  if (login.status() !== 200 || (await login.text()).includes("token")) throw new Error("login body/token");
  const cookie = (await operator.cookies()).find((item) => item.name === "naa_staff_session");
  if (!cookie?.httpOnly || cookie.sameSite !== "Strict") throw new Error("cookie flags");
  for (const source of ["expert", "catalog"]) {
    const inquiry = await operatorPage.request.post(`${root}/api/inquiries`, { headers: { origin: root }, data: { phone: "+37377123445", part: "Тестовая деталь", vehicle: "", source } });
    if (inquiry.status() !== 201) throw new Error(`inquiry ${source}: ${inquiry.status()}`);
  }
  await operatorPage.goto(`${root}/admin/orders`, { waitUntil: "networkidle" });
  await operatorPage.getByRole("heading", { name: "Заказы" }).waitFor();
  if (await operatorPage.getByRole("link", { name: "Журнал" }).count()) throw new Error("owner menu visible");
  if (!await operatorPage.getByText("+373 77 ***45").isVisible()) throw new Error("phone not masked");
  if (await operatorPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error("operator mobile overflow");
  await operatorPage.screenshot({ path: "qa/shots/admin-operator-390.png", fullPage: true });
  if ((await operatorPage.goto(`${root}/admin/journal`))?.status() !== 404) throw new Error("operator journal accessible");
  if ((await operatorPage.request.get(`${root}/api/staff/export`)).status() !== 404) throw new Error("operator export accessible");
  await operatorPage.goto(`${root}/admin/requests`);
  await operatorPage.getByText("Тестовая деталь").waitFor();
  await operatorPage.goto(`${root}/admin/applications`);
  await operatorPage.getByText("Тестовая деталь").waitFor();
  if ((await operatorPage.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data: { action: "role", id: 1, role: "owner" } })).status() !== 403) throw new Error("operator changed role");
  await operatorPage.goto(`${root}/admin/orders`, { waitUntil: "networkidle" });
  const revealResponse = await operatorPage.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data: { action: "reveal", id: orderId } });
  if (revealResponse.status() !== 200) throw new Error(`reveal failed: ${revealResponse.status()}`);
  if ((await revealResponse.json()).phone !== "+37377123445") throw new Error("full phone unavailable");
  const oldTab = await operator.newPage();
  await oldTab.goto(`${root}/admin/orders`);
  const oldCookie = `${cookie.name}=${cookie.value}`;
  const logout = await operatorPage.request.post(`${root}/api/staff/logout?all=1`, { headers: { origin: root } });
  if (logout.status() !== 204) throw new Error(`logout: ${logout.status()}`);
  const stale = await operatorPage.request.get(`${root}/api/staff/me`, { headers: { cookie: oldCookie } });
  if (stale.status() !== 401) throw new Error(`old session works: ${stale.status()}`);
  await oldTab.reload();
  await oldTab.waitForURL("**/admin/login");

  const owner = await browser.newContext();
  const ownerLogin = await owner.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: ownerPhone, password } });
  if (ownerLogin.status() !== 200) throw new Error("owner login failed");
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`${root}/admin/journal`);
  await ownerPage.getByText("Просмотр полного телефона клиента").first().waitFor();
  await ownerPage.screenshot({ path: "qa/shots/admin-journal-1280.png", fullPage: true });
  await ownerPage.goto(`${root}/admin/users`);
  await ownerPage.getByRole("heading", { name: "Пользователи" }).waitFor();
  const ownerCookie = (await owner.cookies()).find((item) => item.name === "naa_staff_session");
  db.prepare("UPDATE staff_sessions SET last_seen=? WHERE token_hash=?").run(Date.now() - 2 * 60 * 60 * 1000 - 1, createHash("sha256").update(ownerCookie.value).digest("hex"));
  if ((await owner.request.get(`${root}/api/staff/me`)).status() !== 401) throw new Error("idle session not expired");

  const blockedPhone = "+37377777999";
  for (let i = 0; i < 6; i++) {
    const response = await owner.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone: blockedPhone, password: "wrong" } });
    const error = await response.json().catch(() => ({}));
    if (response.status() !== 401 || error.message !== "Неверный телефон или пароль") throw new Error(`login error differs: ${response.status()} ${JSON.stringify(error)}`);
  }
  const count = db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE phone=?").get(blockedPhone).n;
  if (count !== 5) throw new Error(`rate limit: ${count}`);
  console.log("owner/operator, masked reveal, audit, cookie, logout, rate limit: OK");
  await owner.close(); await operator.close();
} finally {
  if (db) {
    db.prepare("DELETE FROM inquiries WHERE phone=? AND part=?").run("+37377123445", "Тестовая деталь");
    if (orderId) db.prepare("DELETE FROM orders WHERE id=?").run(orderId);
    const ids = db.prepare("SELECT id FROM staff_users WHERE phone IN (?,?)").all(ownerPhone, operatorPhone).map((row) => row.id);
    for (const id of ids) db.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(id);
    db.prepare("DELETE FROM staff_users WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
    db.prepare("DELETE FROM staff_audit WHERE actor_name IN ('Тест Owner','Тест Operator')").run();
    db.prepare("DELETE FROM login_attempts WHERE phone IN (?,?,?,?)").run(ownerPhone, operatorPhone, "+37300000000", "+37377777999");
    db.close();
  }
  await browser.close();
}

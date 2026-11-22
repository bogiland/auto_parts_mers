import { chromium } from "playwright";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { unlinkSync } from "node:fs";
import { join } from "node:path";

const db = new DatabaseSync("data/orders.sqlite");
const browser = await chromium.launch({ channel: "chrome" });
const secret = randomBytes(16).toString("hex");
const salt = randomBytes(16);
const passwordHash = `${salt.toString("hex")}:${scryptSync(secret, salt, 64).toString("hex")}`;
const ownerPhone = "+37377776301", operatorPhone = "+37377776302";
const root = "http://localhost:3000";
// next dev иногда отдаёт пустую страницу: он читает ещё не дописанный манифест и падает
// с «Unexpected end of JSON input». Это сбой сборщика, а не приложения, поэтому один повтор.
async function openDashboard(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${root}/admin/dashboard`);
    try {
      await page.getByRole("heading", { name: "Дашборд" }).waitFor({ timeout: 15000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(3000);
    }
  }
}
try {
  for (const row of db.prepare("SELECT id FROM staff_users WHERE phone IN (?,?)").all(ownerPhone, operatorPhone)) db.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(row.id);
  db.prepare("DELETE FROM staff_users WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'owner')").run("QA Owner", ownerPhone, passwordHash);
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'operator')").run("QA Operator", operatorPhone, passwordHash);
  for (const [phone, role] of [[ownerPhone, "owner"], [operatorPhone, "operator"]]) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const response = await context.request.post(`${root}/api/staff/login`, { headers: { origin: root }, data: { phone, password: secret } });
      if (response.status() !== 200) throw new Error(`Login ${role}: ${response.status()}`);
      const page = await context.newPage();
      await openDashboard(page);
      if (role === "operator") {
        if (await page.getByRole("link", { name: "Настройки" }).count()) throw new Error("Owner menu shown to operator");
        const protectedResponse = await page.goto(`${root}/admin/settings`);
        if (protectedResponse?.status() !== 404) throw new Error(`Operator settings returned ${protectedResponse?.status()}: ${page.url()}`);
        await page.goto(`${root}/admin/orders`);
      } else {
        await page.goto(`${root}/admin/settings`);
        await page.getByRole("heading", { name: "Настройки" }).waitFor();
        if (await page.locator('input[name="rubPerMdl"]').inputValue() !== "") throw new Error("Currency rate unexpectedly filled");
        if (await page.locator('input[name="phonePmr"]').inputValue() !== "+37377745636") throw new Error("PMR phone missing");
        if (width === 1440) { await page.getByRole("button", { name: "Сохранить" }).click(); await page.getByText("Сохранено").waitFor(); }
        if (width === 1440) {
          const addResponse = await context.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data: { action: "add-product", name: "QA Test Part", productType: "Двигатель", price: 123, stock: 1, returnRestricted: "on" } });
          if (addResponse.status() !== 200) throw new Error(`Add part: ${addResponse.status()} ${await addResponse.text()}`);
          const part = db.prepare("SELECT id FROM catalog_products WHERE name='QA Test Part' AND return_restricted=1 AND product_type='Двигатель'").get();
          if (!part) throw new Error("New part not saved");
          const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6V3QAAAAASUVORK5CYII=";
          const upload = await context.request.post(`${root}/api/staff/action`, { headers: { origin: root }, data: { action: "photos", id: part.id, photos: [photo] } });
          if (upload.status() !== 200) throw new Error(`Photo upload: ${upload.status()} ${await upload.text()}`);
          if (JSON.parse(db.prepare("SELECT photos_json FROM catalog_products WHERE id=?").get(part.id).photos_json).length !== 1) throw new Error("Photo not persisted");
          await page.goto(`${root}/admin/settings`);
        }
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${role} overflow ${width}`);
      await page.screenshot({ path: `qa/shots/admin-${role}-${width}.png`, fullPage: true });
      if (role === "owner" && width === 1440) {
        await page.evaluate(() => localStorage.setItem("naa-admin-theme", "light"));
        await page.reload();
        await page.locator('.admin-shell[data-theme="light"]').waitFor({ timeout: 5000 });
        await page.screenshot({ path: "qa/shots/admin-owner-light-1440.png", fullPage: true });
      }
      await context.close();
    }
  }
  console.log("PASS: Owner/Operator, 390/1440, access, settings, theme, part and photo persistence");
} finally {
  for (const row of db.prepare("SELECT id FROM staff_users WHERE phone IN (?,?)").all(ownerPhone, operatorPhone)) db.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(row.id);
  db.prepare("DELETE FROM staff_users WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  for (const row of db.prepare("SELECT photos_json FROM catalog_products WHERE name='QA Test Part'").all()) for (const item of JSON.parse(row.photos_json)) { const photo = typeof item === "string" ? item : item.src; if (/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(photo)) { try { unlinkSync(join("public", photo.slice(1))); } catch {} } }
  db.prepare("DELETE FROM catalog_products WHERE name='QA Test Part'").run();
  db.prepare("DELETE FROM staff_audit WHERE actor_name IN ('QA Owner','QA Operator')").run();
  db.prepare("DELETE FROM login_attempts WHERE phone IN (?,?)").run(ownerPhone, operatorPhone);
  db.close(); await browser.close();
}

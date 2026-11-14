import { createRequire } from "node:module";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Номер можно вводить как привычно: 77745636, 077745636 или +373 777 45 636.
function toInternational(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("373")) return `+${digits}`;
  return `+373${digits.replace(/^0+/, "")}`;
}

const [nameInput, phoneInput] = process.argv.slice(2);
const name = nameInput?.trim() ?? "";
const phone = toInternational(phoneInput);
if (name.length < 2 || !/^\+\d{8,15}$/.test(phone)) { console.error("Проверьте имя и телефон. Телефон можно писать как 77745636 или +373 777 45 636."); process.exit(1); }
let password = "";
for await (const chunk of process.stdin) password += chunk.toString();
password = password.trimEnd();
if (password.length < 12) { console.error("Пароль должен содержать не менее 12 символов."); process.exit(1); }

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");
mkdirSync("data", { recursive: true });
const db = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
db.exec("CREATE TABLE IF NOT EXISTS staff_users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','operator')), active INTEGER NOT NULL DEFAULT 1)");
if (db.prepare("SELECT COUNT(*) AS n FROM staff_users WHERE role='owner' AND active=1").get().n) {
  console.error("Owner уже существует. Новых сотрудников добавляйте в админке.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,'owner')").run(name, phone, hash);
db.close();
console.log("Owner создан. Откройте http://localhost:3000/admin/login");

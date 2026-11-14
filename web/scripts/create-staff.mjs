// Создание сотрудника из командной строки. Нужен, когда в базе ещё нет ни одного владельца
// (войти неоткуда) или когда владелец забыл пароль: у сайта нет самостоятельной регистрации,
// и это сделано нарочно — админка не должна открываться никому с улицы.
//
//   node scripts/create-staff.mjs "Имя" "+37377745636" owner            — пароль спросит с клавиатуры
//   echo "ПарольНеМенее12" | node scripts/create-staff.mjs "Имя" "+373..." operator
//   node scripts/create-staff.mjs --list                                — показать сотрудников
//
// Если сотрудник с таким телефоном уже есть, пароль и роль перезаписываются,
// а все его открытые сессии закрываются.

import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");
mkdirSync("data", { recursive: true });
const db = new DatabaseSync(path.join(process.cwd(), "data", "orders.sqlite"));
db.exec(`CREATE TABLE IF NOT EXISTS staff_users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','operator')), active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS staff_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, last_seen INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY, phone TEXT NOT NULL, at INTEGER NOT NULL);`);

// Номер можно вводить как привычно: 77745636, 077745636 или +373 777 45 636.
function toInternational(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("373")) return `+${digits}`;
  return `+373${digits.replace(/^0+/, "")}`;
}

const argv = process.argv.slice(2);

if (argv[0] === "--list") {
  const rows = db.prepare("SELECT id,name,phone,role,active FROM staff_users ORDER BY id").all();
  console.log(rows.length ? rows.map((row) => `${row.id}\t${row.role}\t${row.phone}\t${row.name}${row.active ? "" : "\t(выключен)"}`).join("\n") : "Сотрудников нет. Создайте владельца этим же скриптом.");
  db.close();
  process.exit(0);
}

const [nameInput, phoneInput, roleInput = "operator"] = argv;
const name = nameInput?.trim() ?? "";
const phone = toInternational(phoneInput);
const role = roleInput === "owner" ? "owner" : "operator";
if (name.length < 2 || !/^\+\d{8,15}$/.test(phone)) {
  console.error('Как пользоваться: node scripts/create-staff.mjs "Имя" "77745636" owner|operator');
  console.error("Телефон можно писать как угодно: 77745636, 077745636 или +373 777 45 636 — он сам приводится к международному виду.");
  process.exit(1);
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let piped = "";
    for await (const chunk of process.stdin) piped += chunk.toString();
    return piped.trimEnd();
  }
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => reader.question("Пароль (не менее 12 символов): ", resolve));
  } finally {
    reader.close();
  }
}

const password = (await readPassword()).trim();
if (password.length < 12) {
  console.error("Пароль должен содержать не менее 12 символов.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
const existing = db.prepare("SELECT id FROM staff_users WHERE phone=?").get(phone);
if (existing) {
  db.prepare("UPDATE staff_users SET name=?,password_hash=?,role=?,active=1 WHERE id=?").run(name, hash, role, existing.id);
  db.prepare("UPDATE staff_sessions SET revoked=1 WHERE user_id=?").run(existing.id);
  console.log(`Сотрудник обновлён: ${name}, ${phone}, роль ${role}. Прежние сессии закрыты.`);
} else {
  db.prepare("INSERT INTO staff_users(name,phone,password_hash,role) VALUES(?,?,?,?)").run(name, phone, hash, role);
  console.log(`Сотрудник создан: ${name}, ${phone}, роль ${role}.`);
}
db.prepare("DELETE FROM login_attempts WHERE phone=?").run(phone);
db.close();
console.log("Вход: http://localhost:3000/admin/login");

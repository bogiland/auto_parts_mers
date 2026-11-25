// Поднимает локальную базу в контейнере. Пароль берётся из DATABASE_URL в .env.local
// и нигде не записывается: в package.json его быть не должно — этот файл в репозитории.
//
//   npm run db:up
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line.replace(/^﻿/, ""));
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const value = process.env.DATABASE_URL;
if (!value) {
  console.error("Не задан DATABASE_URL. Скопируйте .env.example в .env.local и впишите свои значения.");
  process.exit(1);
}

let url;
try { url = new URL(value); } catch {
  console.error("DATABASE_URL не похож на адрес подключения.");
  process.exit(1);
}
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  console.error("db:up поднимает только локальную базу. В DATABASE_URL указан не localhost — команда остановлена.");
  process.exit(1);
}

const container = process.env.NAA_DB_CONTAINER || "naa-postgres";
const user = decodeURIComponent(url.username || "naa");
const password = decodeURIComponent(url.password || "");
const database = url.pathname.replace(/^\//, "") || "naa";
const port = url.port || "5432";
if (!password) {
  console.error("В DATABASE_URL нет пароля. Впишите его в .env.local.");
  process.exit(1);
}

const docker = (args, quiet = false) => {
  try { return execFileSync("docker", args, { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" }); }
  catch { return null; }
};

if (docker(["start", container], true) !== null) {
  console.log(`Контейнер ${container} запущен.`);
  process.exit(0);
}

const created = docker([
  "run", "-d", "--name", container,
  "-e", `POSTGRES_USER=${user}`,
  "-e", `POSTGRES_PASSWORD=${password}`,
  "-e", `POSTGRES_DB=${database}`,
  "-p", `${port}:5432`,
  "-v", "naa-pgdata:/var/lib/postgresql/data",
  "postgres:17-alpine",
], true);

if (created === null) {
  console.error(`Не удалось создать контейнер ${container}. Проверьте, запущен ли Docker.`);
  process.exit(1);
}
console.log(`Контейнер ${container} создан и запущен. Дальше: npm run db:migrate`);

// Накатывает db/schema.sql на базу из DATABASE_URL. Выполняется повторно без вреда:
// в схеме всё создаётся через IF NOT EXISTS.
//
//   npm run db:migrate
//   DATABASE_URL="postgres://..." npm run db:migrate   — накатить на Supabase
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  // Next сам читает .env.local только в приложении, скриптам нужно подхватить вручную.
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Не задан DATABASE_URL. Запустите базу: npm run db:up");
  process.exit(1);
}

const schema = readFileSync(path.join("db", "schema.sql"), "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(schema);
  await client.query(readFileSync(path.join("db", "operations.sql"), "utf8"));
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  );
  console.log(`Схема накатана. Таблиц: ${rows.length}`);
  console.log(rows.map((row) => `  ${row.table_name}`).join("\n"));
} finally {
  await client.end();
}

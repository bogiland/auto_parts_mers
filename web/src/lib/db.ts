import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage<PoolClient>();

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (context.getStore()) return (await work());
  return (await tx(async (client) => (await context.run(client, work))));
}

// Одно подключение на процесс. В разработке Next пересобирает модули на каждом изменении,
// поэтому пул кладётся в globalThis — иначе за сессию накопятся десятки подключений.
type Globals = typeof globalThis & { naaPool?: Pool };
const globals = globalThis as Globals;

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    // Строка подключения с паролем в тексте ошибки попадает в журнал и в вывод сборки,
    // поэтому здесь только имя переменной и команда, которая её заполняет.
    throw new Error(
      "Не задан DATABASE_URL. Скопируйте .env.example в .env.local и поднимите базу: npm run db:up.",
    );
  }
  return value;
}

export function pool(): Pool {
  if (!globals.naaPool) {
    const url = connectionString();
    globals.naaPool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Supabase требует TLS, локальный контейнер — нет.
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    });
  }
  return globals.naaPool;
}

/** Все строки запроса. */
export async function many<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await (context.getStore() ?? pool()).query<T>(text, values as never[]);
  return result.rows;
}

/** Первая строка или null — удобнее, чем каждый раз разбирать массив. */
export async function one<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<T | null> {
  const rows = await many<T>(text, values);
  return rows[0] ?? null;
}

/** Запрос без результата. Возвращает число затронутых строк — по нему проверяем «нашлось ли». */
export async function run(text: string, values: unknown[] = []): Promise<number> {
  const result = await (context.getStore() ?? pool()).query(text, values as never[]);
  return result.rowCount ?? 0;
}

/**
 * Транзакция. Всё внутри идёт по одному соединению: иначе параллельные запросы
 * разъедутся по разным соединениям пула и окажутся вне транзакции.
 */
export async function tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => { /* соединение уже могло оборваться */ });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Транзакция, к которой привязаны и обычные помощники one/many/run.
 * Без этой привязки вложенный запрос берёт из пула ВТОРОЕ соединение, хотя
 * первое уже занято транзакцией. При десятке одновременных оформлений пул
 * выбирается целиком, и все ждут соединения, которое освободится только после
 * них самих — сайт встаёт. Здесь вложенные запросы идут по тому же соединению.
 */
export async function txBound<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  return tx((client) => context.run(client, () => work(client)));
}

/** Те же помощники, но внутри транзакции. */
export const inTx = {
  async many<T extends QueryResultRow = QueryResultRow>(client: PoolClient, text: string, values: unknown[] = []): Promise<T[]> {
    const result = await client.query<T>(text, values as never[]);
    return result.rows;
  },
  async one<T extends QueryResultRow = QueryResultRow>(client: PoolClient, text: string, values: unknown[] = []): Promise<T | null> {
    const result = await client.query<T>(text, values as never[]);
    return result.rows[0] ?? null;
  },
  async run(client: PoolClient, text: string, values: unknown[] = []): Promise<number> {
    const result = await client.query(text, values as never[]);
    return result.rowCount ?? 0;
  },
};

// Parameter binding for the remaining repositories: all values stay separate from SQL.
function parameterized(source: string) {
  let index = 0;
  let quoted = false;
  let sql = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "'") {
      if (quoted && source[i + 1] === "'") { sql += "''"; i++; continue; }
      quoted = !quoted;
    }
    sql += ch === "?" && !quoted ? `$${++index}` : ch;
  }
  sql = sql.replace(/group_concat\(/gi, "string_agg(");
  if (/INSERT OR IGNORE/i.test(sql)) sql = sql.replace(/INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING";
  return sql;
}

export const legacyQuery = {
  async get<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T | undefined> {
    return (await one<T>(parameterized(sql), values)) ?? undefined;
  },
  async all<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    return (await many<T>(parameterized(sql), values));
  },
  async run<T extends QueryResultRow>(source: string, values: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number; row?: T }> {
    let sql = parameterized(source);
    const table = /^\s*INSERT INTO\s+(\w+)/i.exec(sql)?.[1];
    const identity = table && ["customers", "customer_addresses", "customer_sessions", "customer_attempts", "stock_moves", "orders", "order_returns", "order_status_history"].includes(table) && table !== "customer_sessions";
    if (identity && !/RETURNING/i.test(sql)) sql += " RETURNING id";
    const result = await (context.getStore() ?? pool()).query(sql, values);
    return { changes: result.rowCount ?? 0, lastInsertRowid: Number(result.rows[0]?.id ?? 0) };
  },
};

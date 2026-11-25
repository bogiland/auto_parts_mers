// Матрица прав: гость / оператор / владелец по каждой странице админки и каждому действию API.
// Запускается против локального сервера на 3000. Телефоны в выводе маскируются.
//
//   node qa/p2-roles-check.mjs
//
// Учётные записи заводятся заранее:
//   echo "<пароль>" | node scripts/create-staff.mjs "Проверка П2 владелец" "60900021" owner
//   echo "<пароль>" | node scripts/create-staff.mjs "Проверка П2 оператор" "60900022" operator
const BASE = "http://localhost:3000";
const ORIGIN = BASE;
const OWNER = { phone: "+37360900021", label: "владелец" };
const OPERATOR = { phone: "+37360900022", label: "оператор" };
const SECRET = process.env.NAA_QA_PASSWORD ?? "proverka-p2-2026-stroka";
const mask = (value) => String(value).replace(/^(\+\d{5})\d+(\d{2})$/, "$1***$2");

const jar = () => ({ cookies: new Map() });
function store(j, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) j.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function call(j, path, init = {}) {
  const headers = { Origin: ORIGIN, ...(init.headers ?? {}) };
  const cookie = [...(j?.cookies ?? [])].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookie) headers.Cookie = cookie;
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  if (j) store(j, res);
  return res;
}

async function signIn(who) {
  const j = jar();
  // Каждому входу свой адрес: иначе предел на подбор пароля срабатывает на самой проверке.
  const res = await call(j, "/api/staff/login", {
    method: "POST",
    headers: { "x-forwarded-for": `198.51.100.${who === OWNER ? 11 : 12}` },
    body: JSON.stringify({ phone: who.phone, password: SECRET }),
  });
  if (res.status !== 200) throw new Error(`${who.label} (${mask(who.phone)}) не вошёл: ${res.status}`);
  return j;
}

/** Страницы админки. ok — что должно получиться у роли: 200 открыта, 404 спрятана, 307 увод на вход. */
const pages = [
  ["/admin", { guest: 307, operator: 307, owner: 307 }], // увод на /admin/dashboard
  ["/admin/dashboard", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/orders", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/inventory", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/requests", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/applications", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/donors", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/reference", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/clients", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/tasks", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/journal", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/costs", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/candidates", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/returns", { guest: 307, operator: 200, owner: 200 }],
  ["/admin/money", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/reports", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/users", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/settings", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/pages", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/news", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/vacancies", { guest: 307, operator: 404, owner: 200 }],
  ["/admin/advertising", { guest: 307, operator: 404, owner: 200 }],
];

/**
 * Действия API. Ожидается не «получилось», а «не отказано по правам»:
 * 400 из-за выдуманного идентификатора — нормальный ответ, он означает, что до проверки
 * данных дело дошло. Отказом по правам считаются 401, 403 и 404.
 */
const denied = new Set([401, 403, 404]);
const actions = [
  ["смена роли", "/api/staff/action", { action: "role", id: 999999, role: "operator" }, { guest: "deny", operator: "deny", owner: "deny-until-confirm" }],
  ["создание сотрудника", "/api/staff/action", { action: "add-user", name: "Нет", phone: "+37360000000", password: "dlinniy-parol-123", role: "operator" }, { guest: "deny", operator: "deny", owner: "deny-until-confirm" }],
  ["выдача доступа", "/api/staff/action", { action: "grant-staff", customerId: 999999, role: "operator" }, { guest: "deny", operator: "deny", owner: "deny-until-confirm" }],
  ["удаление сотрудника", "/api/staff/action", { action: "delete-user", id: 999999 }, { guest: "deny", operator: "deny", owner: "deny-until-confirm" }],
  ["настройки магазина", "/api/staff/action", { action: "settings" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["себестоимость", "/api/staff/action", { action: "cost", id: "demo-part-49", cost: 1 }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["поиск людей", "/api/staff/action", { action: "find-people", query: "тест" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["остаток детали", "/api/staff/action", { action: "inventory", id: "нет-такой", price: 1, stock: 1 }, { guest: "deny", operator: "allow", owner: "allow" }],
  ["показать телефон", "/api/staff/action", { action: "reveal", id: 2 }, { guest: "deny", operator: "allow", owner: "allow" }],
  ["правка детали", "/api/staff/parts", { action: "update-part", id: "нет-такой" }, { guest: "deny", operator: "allow", owner: "allow" }],
  ["статья", "/api/staff/news", { action: "news", slug: "нет", title_ru: "Нет" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["вакансия", "/api/staff/vacancies", { action: "vacancy", title: "Нет", description: "Нет текста" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["реклама", "/api/staff/ads", { action: "slot-price", placement: "нет", price: 1 }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["страница сайта", "/api/staff/pages", { action: "save", slug: "нет" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["справочник", "/api/staff/reference", { action: "save-brand", name: "" }, { guest: "deny", operator: "deny", owner: "allow" }],
  ["модерация отзыва", "/api/staff/reviews", { id: 999999, status: "published" }, { guest: "deny", operator: "allow", owner: "allow" }],
];

/** Выгрузка — отдельно: это GET, и у владельца она требует подтверждения паролем. */
const exportExpect = { guest: 401, operator: 404, owner: 403 };

const sessions = { guest: jar(), operator: await signIn(OPERATOR), owner: await signIn(OWNER) };
const roles = ["guest", "operator", "owner"];
const problems = [];
let checks = 0;

console.log("### Страницы админки\n");
for (const [path, expect] of pages) {
  const row = [];
  for (const role of roles) {
    const res = await call(sessions[role], path);
    checks++;
    const ok = res.status === expect[role];
    if (!ok) problems.push(`${path} · ${role}: ожидалось ${expect[role]}, получено ${res.status}`);
    row.push(`${role} ${res.status}${ok ? "" : ` (ждали ${expect[role]})`}`);
  }
  console.log(`  ${path.padEnd(22)} ${row.join(" · ")}`);
}

console.log("\n### Действия API\n");
for (const [label, path, body, expect] of actions) {
  const row = [];
  for (const role of roles) {
    const res = await call(sessions[role], path, { method: "POST", body: JSON.stringify(body) });
    checks++;
    const refused = denied.has(res.status);
    const wanted = expect[role];
    // deny-until-confirm: владельцу тоже отказано, пока он не ввёл пароль заново.
    const ok = wanted === "allow" ? !refused : refused;
    if (!ok) problems.push(`${label} · ${role}: ${res.status}, ожидалось ${wanted}`);
    row.push(`${role} ${res.status}${ok ? "" : " ✗"}`);
  }
  console.log(`  ${label.padEnd(24)} ${row.join(" · ")}`);
}

console.log("\n### Выгрузка заказов\n");
for (const role of roles) {
  const res = await call(sessions[role], "/api/staff/export");
  checks++;
  const ok = res.status === exportExpect[role];
  if (!ok) problems.push(`экспорт · ${role}: ${res.status}, ожидалось ${exportExpect[role]}`);
  console.log(`  ${role.padEnd(10)} ${res.status}${ok ? "" : ` (ждали ${exportExpect[role]})`}`);
}

console.log("\n### Подтверждение паролем открывает закрытое\n");
{
  // Пока пароль не подтверждён — отказ; после подтверждения выгрузка идёт.
  const before = await call(sessions.owner, "/api/staff/export");
  const confirm = await call(sessions.owner, "/api/staff/confirm", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.13" },
    body: JSON.stringify({ scope: "export", password: SECRET }),
  });
  const after = await call(sessions.owner, "/api/staff/export");
  // Оператор подтвердить ту же выгрузку не может: у него её вообще нет.
  const operatorTry = await call(sessions.operator, "/api/staff/export");
  checks += 4;
  const ok = before.status === 403 && confirm.status === 200 && after.status === 200 && operatorTry.status === 404;
  if (!ok) problems.push(`подтверждение: до ${before.status}, подтверждение ${confirm.status}, после ${after.status}, оператор ${operatorTry.status}`);
  console.log(`  до подтверждения ${before.status} · подтверждение ${confirm.status} · после ${after.status} · оператор ${operatorTry.status}`);

  const wrong = await call(sessions.owner, "/api/staff/confirm", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.14" },
    body: JSON.stringify({ scope: "export", password: "ne-tot-parol-sovsem" }),
  });
  checks++;
  if (wrong.status !== 401) problems.push(`неверный пароль при подтверждении: ${wrong.status}, ожидалось 401`);
  console.log(`  неверный пароль: ${wrong.status}`);
}

console.log(`\n=== ИТОГ ===\nпроверок: ${checks} · расхождений: ${problems.length}`);
for (const line of problems) console.log("  !! " + line);
console.log(`Учётные записи проверки: ${mask(OWNER.phone)} (владелец), ${mask(OPERATOR.phone)} (оператор).`);
process.exitCode = problems.length ? 1 : 0;

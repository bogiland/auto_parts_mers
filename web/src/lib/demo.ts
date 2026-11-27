/**
 * Демонабор (П9). Демо-доноры, детали, отзывы, новости и вакансии помечены demo_tag = 'naa-demo-…'
 * и остаются в сиде: на них проверяют сайт. На витрине они видны, только если в окружении
 * NAA_SHOW_DEMO=1 (так задано в локальном .env.local). На боевом сервере переменной нет —
 * демо скрыто, а из базы ничего не удаляется.
 */
export function showDemo(): boolean {
  return process.env.NAA_SHOW_DEMO === "1";
}

/** SQL-условие «не демо» для таблицы с колонкой demo_tag. Когда демо показывается — всегда истина. */
export function notDemo(alias = ""): string {
  if (showDemo()) return "TRUE";
  const column = alias ? `${alias}.demo_tag` : "demo_tag";
  return `(${column} IS NULL OR ${column} NOT LIKE 'naa-demo%')`;
}

export function isDemoTag(tag: unknown): boolean {
  return typeof tag === "string" && tag.startsWith("naa-demo");
}

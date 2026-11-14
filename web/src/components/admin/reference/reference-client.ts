export async function referenceAction(body: Record<string, unknown>): Promise<{ ok?: boolean; id?: string }> {
  const response = await fetch("/api/staff/reference", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Не удалось сохранить. Попробуйте снова.");
  return (await response.json().catch(() => ({}))) as { ok?: boolean; id?: string };
}

export function slugPreview(value: string) {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ă: "a", â: "a", î: "i", ș: "s", ț: "t" };
  return value.toLowerCase().split("").map((letter) => map[letter] ?? letter).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { cookieName } from "@/lib/staff-auth";
import { session } from "@/lib/staff-db";
import { privateUploadDir } from "@/lib/reference-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Имя файла задаём мы сами: 32 шестнадцатеричных знака и расширение.
// Всё остальное — попытка выйти из каталога, такие запросы до диска не доходят.
const shape = /^[a-f0-9]{32}\.(webp|jpg|png)$/;
const types: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!shape.test(file)) return new Response(null, { status: 404 });
  // Фото выдачи — внутренний документ: без входа сотрудника файл не отдаётся.
  const actor = await session((await cookies()).get(cookieName)?.value);
  if (!actor) return new Response(null, { status: 401 });
  try {
    const bytes = await readFile(path.join(privateUploadDir, "issue", file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": types[file.split(".").pop() as string] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch { return new Response(null, { status: 404 }); }
}

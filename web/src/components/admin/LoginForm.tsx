"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staff/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: form.get("phone"), password: form.get("password") }) });
      if (!response.ok) { setError("Неверный телефон или пароль"); return; }
      router.replace("/admin/dashboard"); router.refresh();
    } catch { setError("Не удалось подключиться. Попробуйте снова."); }
    finally { setBusy(false); }
  }
  return <form className="w-full max-w-sm rounded-xl border border-white/10 bg-header p-7 shadow-card" onSubmit={submit}><div className="mb-7 text-center"><span className="text-3xl font-black tracking-tight">NAA<span className="text-accent">.md</span></span><p className="mt-2 text-sm text-white/60">Вход для сотрудников</p></div><label className="block text-sm">Телефон<input autoComplete="username" className="mt-2 w-full rounded-ui border border-white/20 bg-header-dark p-3 text-white outline-none focus:border-accent" name="phone" placeholder="+373 ..." required type="tel" /></label><label className="mt-4 block text-sm">Пароль<input autoComplete="current-password" className="mt-2 w-full rounded-ui border border-white/20 bg-header-dark p-3 text-white outline-none focus:border-accent" name="password" required type="password" /></label>{error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}<button className="mt-6 w-full rounded-ui bg-accent p-3 font-bold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Входим…" : "Войти"}</button></form>;
}

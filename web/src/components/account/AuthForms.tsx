"use client";
// Вход и регистрация покупателя. Форма живёт в браузере: нужны проверка полей и показ ошибки от сервера.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

const field = "h-control w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent";
const label = "block text-meta text-ink-2";
const button = "h-control w-full rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-60";

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { message?: string; field?: string };
  if (!response.ok) throw Object.assign(new Error(data.message ?? "Не удалось выполнить."), { field: data.field });
  return data;
}

function useNext() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  // Переходим только внутрь сайта: чужой адрес в ссылке увёл бы покупателя на сторонний ресурс.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export function CustomerLoginForm() {
  const router = useRouter();
  const next = useNext();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await send({ action: "login", login: form.get("login"), password: form.get("password") });
      router.replace(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="flex flex-col gap-4 rounded-ui bg-white p-4 shadow-card md:p-6" onSubmit={submit}>
    <h1 className="text-section font-bold text-ink">Вход в личный кабинет</h1>
    <label className={label}>Почта или телефон<input autoComplete="username" className={`mt-1 ${field}`} name="login" placeholder="mail@example.com или 077 123 456" required /></label>
    <label className={label}>Пароль<input autoComplete="current-password" className={`mt-1 ${field}`} name="password" required type="password" /></label>
    {error && <p className="text-body text-accent" role="alert">{error}</p>}
    <button className={button} disabled={busy} type="submit">{busy ? "Входим…" : "Войти"}</button>
    <p className="text-body text-ink-2">Нет кабинета? <Link className="font-bold text-accent hover:underline" href={`/register?next=${encodeURIComponent(next)}`}>Зарегистрироваться</Link></p>
    <p className="rounded-ui bg-surface-2 p-3 text-meta text-ink-2">Кабинет нужен, чтобы видеть свои заказы и адреса в одном месте. Купить деталь можно и без него: оформите заказ, оператор перезвонит с 8:00 до 20:00, а статус заказа откроется по ссылке.</p>
    <p className="text-meta text-ink-2">Забыли пароль? Позвоните оператору — он проверит вас по заказам и поможет войти. Автоматического восстановления по почте пока нет.</p>
  </form>;
}

export function CustomerRegisterForm() {
  const router = useRouter();
  const next = useNext();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (String(form.get("password")) !== String(form.get("repeat"))) {
      setError("Пароли не совпадают.");
      setBusy(false);
      return;
    }
    try {
      await send({
        action: "register",
        name: form.get("name"), surname: form.get("surname"), email: form.get("email"),
        phone: form.get("phone"), password: form.get("password"), agreed: form.get("agreed") === "on",
      });
      router.replace(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось зарегистрироваться.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="flex flex-col gap-4 rounded-ui bg-white p-4 shadow-card md:p-6" onSubmit={submit}>
    <h1 className="text-section font-bold text-ink">Регистрация</h1>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className={label}>Имя<input autoComplete="given-name" className={`mt-1 ${field}`} name="name" required /></label>
      <label className={label}>Фамилия<input autoComplete="family-name" className={`mt-1 ${field}`} name="surname" /></label>
      <label className={label}>Электронная почта<input autoComplete="email" className={`mt-1 ${field}`} name="email" required type="email" /></label>
      <label className={label}>Телефон<input autoComplete="tel" className={`mt-1 ${field}`} inputMode="tel" name="phone" placeholder="077 123 456" required type="tel" /></label>
      <label className={label}>Пароль<input autoComplete="new-password" className={`mt-1 ${field}`} minLength={8} name="password" required type="password" /></label>
      <label className={label}>Повторите пароль<input autoComplete="new-password" className={`mt-1 ${field}`} minLength={8} name="repeat" required type="password" /></label>
    </div>
    <p className="text-meta text-ink-2">Пароль — не короче восьми символов. Телефон можно писать привычно: 077 123 456 или +373 77 123 456.</p>
    <label className="flex gap-2 text-meta text-ink-2"><input className="mt-1" name="agreed" required type="checkbox" /><span>Согласен на обработку <Link className="underline hover:text-ink" href="/privacy">персональных данных</Link>. Телефон нужен оператору, чтобы подтвердить заказ.</span></label>
    {error && <p className="text-body text-accent" role="alert">{error}</p>}
    <button className={button} disabled={busy} type="submit">{busy ? "Создаём кабинет…" : "Зарегистрироваться"}</button>
    <p className="text-body text-ink-2">Уже есть кабинет? <Link className="font-bold text-accent hover:underline" href={`/login?next=${encodeURIComponent(next)}`}>Войти</Link></p>
  </form>;
}

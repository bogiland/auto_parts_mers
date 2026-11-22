"use client";
// Вход и регистрация покупателя. Поля проверяются в браузере до отправки, а ошибку сервера
// показываем под тем же полем, которого она касается, — человеку не нужно гадать, что исправить.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";

import { PhoneInput } from "@/components/forms/PhoneInput";

const field = "h-control w-full min-w-0 rounded-ui border bg-white px-3 text-body text-ink outline-none";
const label = "block text-meta text-ink-2";
const button = "h-control w-full rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-60";
const emailShape = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Вход, выход и смена пароля меняют куку сессии. Внутренний переход роутера этого не замечает:
// шапка и кабинет остаются собранными под прежнего посетителя, и человеку приходится перезагружать
// страницу руками. Поэтому здесь нужна именно полная загрузка — все серверные части отрисуются заново.
function reload(path: string) {
  window.location.assign(path);
}

// Пока React не перехватил форму, кнопка выключена. Иначе браузер отправит форму сам,
// обычным GET — страница перезагрузится, вход не случится, а пароль попадёт в адресную строку.
function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready;
}

type Errors = Record<string, string>;

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { message?: string; field?: string };
  if (!response.ok) throw Object.assign(new Error(data.message ?? "Не удалось выполнить."), { field: data.field });
  return data;
}

/** Ошибка от сервера ложится под своё поле, а общая — над кнопкой. */
function toErrors(reason: unknown, fallback: string): Errors {
  const message = reason instanceof Error ? reason.message : fallback;
  const named = (reason as { field?: string })?.field;
  return named ? { [named]: message } : { form: message };
}

function FieldError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-meta text-accent" role="alert">{error}</p> : null;
}

const border = (error?: string) => (error ? "border-accent" : "border-line focus:border-accent");

function useNext() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  // Переходим только внутрь сайта: чужой адрес в ссылке увёл бы покупателя на сторонний ресурс.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export function CustomerLoginForm() {
  const next = useNext();
  const ready = useHydrated();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const login = String(form.get("login") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const found: Errors = {};
    if (!login) found.login = "Введите почту или телефон.";
    else if (login.includes("@")) { if (!emailShape.test(login)) found.login = "Проверьте адрес почты."; }
    else if (login.replace(/\D/g, "").length < 8) found.login = "Проверьте номер телефона.";
    if (!password) found.password = "Введите пароль.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await send({ action: "login", login, password });
      reload(next);
      return;
    } catch (reason) {
      setErrors(toErrors(reason, "Не удалось войти."));
      setBusy(false);
    }
  }

  return <form className="flex flex-col gap-4 rounded-ui bg-white p-4 shadow-card md:p-6" noValidate onSubmit={submit}>
    <h1 className="text-section font-bold text-ink">Вход в личный кабинет</h1>
    <div>
      <label className={label} htmlFor="login-login">Почта или телефон</label>
      <input autoComplete="username" className={`mt-1 ${field} ${border(errors.login)}`} id="login-login" name="login" placeholder="mail@example.com или 077 123 456" />
      <FieldError error={errors.login} />
    </div>
    <div>
      <label className={label} htmlFor="login-password">Пароль</label>
      <input autoComplete="current-password" className={`mt-1 ${field} ${border(errors.password)}`} id="login-password" name="password" type="password" />
      <FieldError error={errors.password} />
    </div>
    {errors.form && <p className="text-body text-accent" role="alert">{errors.form}</p>}
    <button className={button} disabled={busy || !ready} type="submit">{busy ? "Входим…" : "Войти"}</button>
    <p className="text-body text-ink-2">Нет кабинета? <Link className="font-bold text-accent hover:underline" href={`/register?next=${encodeURIComponent(next)}`}>Зарегистрироваться</Link></p>
    <p className="rounded-ui bg-surface-2 p-3 text-meta text-ink-2">Кабинет нужен, чтобы видеть свои заказы и адреса в одном месте. Купить деталь можно и без него: оформите заказ, оператор перезвонит с 8:00 до 20:00, а статус заказа откроется по ссылке.</p>
    <p className="text-meta text-ink-2">Забыли пароль? Позвоните оператору — он проверит вас по заказам и поможет войти. Автоматического восстановления по почте пока нет.</p>
  </form>;
}

export function CustomerRegisterForm() {
  const next = useNext();
  const ready = useHydrated();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: String(form.get("name") ?? "").trim(),
      surname: String(form.get("surname") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      repeat: String(form.get("repeat") ?? ""),
      agreed: form.get("agreed") === "on",
    };
    const found: Errors = {};
    if (values.name.length < 2) found.name = "Напишите имя — хотя бы две буквы.";
    if (values.name.length > 60) found.name = "Имя длиннее 60 символов.";
    if (values.surname.length > 60) found.surname = "Фамилия длиннее 60 символов.";
    if (!emailShape.test(values.email)) found.email = "Проверьте адрес почты, например mail@example.com.";
    if (!phone || !phoneValid || !isValidPhoneNumber(phone)) found.phone = "Проверьте номер телефона.";
    if (values.password.length < 8) found.password = "Пароль должен быть не короче восьми символов.";
    if (values.repeat !== values.password) found.repeat = "Пароли не совпадают.";
    if (!values.agreed) found.agreed = "Без согласия на обработку данных кабинет не создать.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await send({ action: "register", ...values, phone });
      reload(next);
      return;
    } catch (reason) {
      setErrors(toErrors(reason, "Не удалось зарегистрироваться."));
      setBusy(false);
    }
  }

  return <form className="flex flex-col gap-4 rounded-ui bg-white p-4 shadow-card md:p-6" noValidate onSubmit={submit}>
    <h1 className="text-section font-bold text-ink">Регистрация</h1>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={label} htmlFor="reg-name">Имя</label>
        <input autoComplete="given-name" className={`mt-1 ${field} ${border(errors.name)}`} id="reg-name" name="name" />
        <FieldError error={errors.name} />
      </div>
      <div>
        <label className={label} htmlFor="reg-surname">Фамилия</label>
        <input autoComplete="family-name" className={`mt-1 ${field} ${border(errors.surname)}`} id="reg-surname" name="surname" />
        <FieldError error={errors.surname} />
      </div>
      <div>
        <label className={label} htmlFor="reg-email">Электронная почта</label>
        <input autoComplete="email" className={`mt-1 ${field} ${border(errors.email)}`} id="reg-email" name="email" type="email" />
        <FieldError error={errors.email} />
      </div>
      <div>
        <span className={label}>Телефон</span>
        <div className="mt-1"><PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={Boolean(errors.phone)} /></div>
        <FieldError error={errors.phone} />
      </div>
      <div>
        <label className={label} htmlFor="reg-password">Пароль</label>
        <input autoComplete="new-password" className={`mt-1 ${field} ${border(errors.password)}`} id="reg-password" name="password" type="password" />
        <FieldError error={errors.password} />
      </div>
      <div>
        <label className={label} htmlFor="reg-repeat">Повторите пароль</label>
        <input autoComplete="new-password" className={`mt-1 ${field} ${border(errors.repeat)}`} id="reg-repeat" name="repeat" type="password" />
        <FieldError error={errors.repeat} />
      </div>
    </div>
    <p className="text-meta text-ink-2">Пароль — не короче восьми символов. Телефон выберите со своим кодом страны: по нему оператор подтверждает заказ.</p>
    <div>
      <label className="flex gap-2 text-meta text-ink-2"><input className="mt-1" name="agreed" type="checkbox" /><span>Согласен на обработку <Link className="underline hover:text-ink" href="/privacy">персональных данных</Link>. Телефон нужен оператору, чтобы подтвердить заказ.</span></label>
      <FieldError error={errors.agreed} />
    </div>
    {errors.form && <p className="text-body text-accent" role="alert">{errors.form}</p>}
    <button className={button} disabled={busy || !ready} type="submit">{busy ? "Создаём кабинет…" : "Зарегистрироваться"}</button>
    <p className="text-body text-ink-2">Уже есть кабинет? <Link className="font-bold text-accent hover:underline" href={`/login?next=${encodeURIComponent(next)}`}>Войти</Link></p>
  </form>;
}

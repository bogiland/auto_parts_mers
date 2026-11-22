"use client";
// Формы кабинета: личные данные, смена пароля и адреса. Все шлют запросы в /api/account.

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Star, Trash } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";

import { PhoneInput } from "@/components/forms/PhoneInput";
import type { Address, Customer } from "@/lib/customer-db";

const field = "h-control w-full min-w-0 rounded-ui border bg-white px-3 text-body text-ink outline-none";
const emailShape = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

type Errors = Record<string, string>;

/** Ошибка от сервера ложится под своё поле, а общая — рядом с кнопкой. */
function toErrors(reason: unknown, fallback: string): Errors {
  const message = reason instanceof Error ? reason.message : fallback;
  const named = (reason as { field?: string })?.field;
  return named ? { [named]: message } : { form: message };
}

function FieldError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-meta text-accent" role="alert">{error}</p> : null;
}

const border = (error?: string) => (error ? "border-accent" : "border-line focus:border-accent");
const label = "block text-meta text-ink-2";
const primary = "h-control rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-60";
const ghost = "h-control rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent disabled:opacity-60";
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


async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { message?: string; field?: string; addresses?: Address[] };
  if (!response.ok) throw Object.assign(new Error(data.message ?? "Не удалось сохранить."), { field: data.field });
  return data;
}

export function ProfileForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const ready = useHydrated();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState(customer.phone);
  const [phoneValid, setPhoneValid] = useState(isValidPhoneNumber(customer.phone));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const surname = String(form.get("surname") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const found: Errors = {};
    if (name.length < 2) found.name = "Напишите имя — хотя бы две буквы.";
    if (name.length > 60) found.name = "Имя длиннее 60 символов.";
    if (surname.length > 60) found.surname = "Фамилия длиннее 60 символов.";
    if (!emailShape.test(email)) found.email = "Проверьте адрес почты, например mail@example.com.";
    if (!phone || !phoneValid || !isValidPhoneNumber(phone)) found.phone = "Проверьте номер телефона.";
    setErrors(found);
    setSaved(false);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await send({ action: "profile", name, surname, email, phone });
      setSaved(true);
      router.refresh();
    } catch (reason) {
      setErrors(toErrors(reason, "Не удалось сохранить."));
    } finally {
      setBusy(false);
    }
  }

  return <form className="rounded-ui bg-white p-4 shadow-card md:p-6" noValidate onSubmit={submit}>
    <h2 className="text-block font-bold text-ink">Личные данные</h2>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={label} htmlFor="profile-name">Имя</label>
        <input className={`mt-1 ${field} ${border(errors.name)}`} defaultValue={customer.name} id="profile-name" name="name" />
        <FieldError error={errors.name} />
      </div>
      <div>
        <label className={label} htmlFor="profile-surname">Фамилия</label>
        <input className={`mt-1 ${field} ${border(errors.surname)}`} defaultValue={customer.surname} id="profile-surname" name="surname" />
        <FieldError error={errors.surname} />
      </div>
      <div>
        <label className={label} htmlFor="profile-email">Электронная почта</label>
        <input className={`mt-1 ${field} ${border(errors.email)}`} defaultValue={customer.email} id="profile-email" name="email" type="email" />
        <FieldError error={errors.email} />
      </div>
      <div>
        <span className={label}>Телефон</span>
        <div className="mt-1"><PhoneInput defaultValue={customer.phone} onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={Boolean(errors.phone)} /></div>
        <FieldError error={errors.phone} />
      </div>
    </div>
    <p className="mt-3 text-meta text-ink-2">По этому телефону оператор подтверждает заказы. Если смените его, прошлые заказы останутся привязанными к старому номеру.</p>
    {errors.form && <p className="mt-3 text-body text-accent" role="alert">{errors.form}</p>}
    {saved && <p className="mt-3 text-body text-success" role="status">Сохранено</p>}
    <button className={`mt-4 ${primary}`} disabled={busy || !ready} type="submit">{busy ? "Сохраняем…" : "Продолжать"}</button>
  </form>;
}

export function PasswordForm() {
  const ready = useHydrated();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current") ?? "");
    const password = String(form.get("password") ?? "");
    const found: Errors = {};
    if (!current) found.current = "Введите текущий пароль.";
    if (password.length < 8) found.password = "Новый пароль должен быть не короче восьми символов.";
    else if (password === current) found.password = "Новый пароль совпадает с текущим.";
    if (String(form.get("repeat") ?? "") !== password) found.repeat = "Новые пароли не совпадают.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await send({ action: "password", current: form.get("current"), password: form.get("password") });
      // Пароль сменён, все сессии закрыты — возвращаем на вход полной загрузкой.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- смена сессии требует полной загрузки
      window.location.assign("/login?next=/account");
      return;
    } catch (reason) {
      setErrors(toErrors(reason, "Не удалось сменить пароль."));
      setBusy(false);
    }
  }

  return <form className="rounded-ui bg-white p-4 shadow-card md:p-6" noValidate onSubmit={submit}>
    <h2 className="text-block font-bold text-ink">Изменить пароль</h2>
    <div className="mt-4 flex max-w-md flex-col gap-4">
      <div>
        <label className={label} htmlFor="pass-current">Текущий пароль</label>
        <input autoComplete="current-password" className={`mt-1 ${field} ${border(errors.current)}`} id="pass-current" name="current" type="password" />
        <FieldError error={errors.current} />
      </div>
      <div>
        <label className={label} htmlFor="pass-new">Новый пароль</label>
        <input autoComplete="new-password" className={`mt-1 ${field} ${border(errors.password)}`} id="pass-new" name="password" type="password" />
        <FieldError error={errors.password} />
      </div>
      <div>
        <label className={label} htmlFor="pass-repeat">Повторите новый пароль</label>
        <input autoComplete="new-password" className={`mt-1 ${field} ${border(errors.repeat)}`} id="pass-repeat" name="repeat" type="password" />
        <FieldError error={errors.repeat} />
      </div>
    </div>
    <p className="mt-3 text-meta text-ink-2">После смены пароля вход на всех устройствах закроется — войдите заново.</p>
    {errors.form && <p className="mt-3 text-body text-accent" role="alert">{errors.form}</p>}
    <button className={`mt-4 ${primary}`} disabled={busy || !ready} type="submit">{busy ? "Меняем…" : "Сменить пароль"}</button>
  </form>;
}

export function AddressBook({ initial }: { initial: Address[] }) {
  const ready = useHydrated();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function run(body: Record<string, unknown>) {
    setBusy(true); setErrors({});
    try {
      const data = await send(body);
      if (data.addresses) setAddresses(data.addresses);
      setEditing(null);
      setAdding(false);
      return true;
    } catch (reason) {
      setErrors(toErrors(reason, "Не удалось сохранить."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const city = String(form.get("city") ?? "").trim();
    const street = String(form.get("street") ?? "").trim();
    const found: Errors = {};
    if (city.length < 2) found.city = "Укажите населённый пункт.";
    if (city.length > 80) found.city = "Название длиннее 80 символов.";
    if (street.length < 2) found.street = "Укажите улицу и дом.";
    if (street.length > 160) found.street = "Адрес длиннее 160 символов.";
    setErrors(found);
    if (Object.keys(found).length) return;
    await run({
      action: "save-address", id: editing?.id, title: form.get("title"), city,
      street, note: form.get("note"), isDefault: form.get("isDefault") === "on",
    });
  }

  const form = (address: Address | null) => <form className="mt-4 rounded-ui border border-line p-4" noValidate onSubmit={submit}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={label} htmlFor="addr-title">Название адреса</label>
        <input className={`mt-1 ${field} ${border()}`} defaultValue={address?.title ?? ""} id="addr-title" name="title" placeholder="Дом, работа" />
      </div>
      <div>
        <label className={label} htmlFor="addr-city">Населённый пункт</label>
        <input className={`mt-1 ${field} ${border(errors.city)}`} defaultValue={address?.city ?? ""} id="addr-city" name="city" placeholder="Слободзея" />
        <FieldError error={errors.city} />
      </div>
      <div>
        <label className={label} htmlFor="addr-street">Улица и дом</label>
        <input className={`mt-1 ${field} ${border(errors.street)}`} defaultValue={address?.street ?? ""} id="addr-street" name="street" placeholder="ул. Новосовицкая 25" />
        <FieldError error={errors.street} />
      </div>
      <div>
        <label className={label} htmlFor="addr-note">Примечание для курьера</label>
        <input className={`mt-1 ${field} ${border()}`} defaultValue={address?.note ?? ""} id="addr-note" name="note" placeholder="Подъезд, этаж, ориентир" />
      </div>
    </div>
    <label className="mt-3 flex gap-2 text-meta text-ink-2"><input defaultChecked={address?.isDefault ?? addresses.length === 0} name="isDefault" type="checkbox" />Использовать по умолчанию при оформлении заказа</label>
    {errors.form && <p className="mt-3 text-body text-accent" role="alert">{errors.form}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={primary} disabled={busy || !ready} type="submit">{busy ? "Сохраняем…" : "Сохранить адрес"}</button>
      <button className={ghost} onClick={() => { setEditing(null); setAdding(false); setErrors({}); }} type="button">Отмена</button>
    </div>
  </form>;

  return <section className="rounded-ui bg-white p-4 shadow-card md:p-6">
    <h2 className="text-block font-bold text-ink">Мои адреса</h2>
    <p className="mt-2 text-body text-ink-2">Адрес подставится в оформление заказа, если выберете доставку. Самовывоз адреса не требует.</p>
    {errors.form && <p className="mt-3 text-body text-accent" role="alert">{errors.form}</p>}

    <ul className="mt-4 flex flex-col gap-3">
      {addresses.map((address) => <li className="flex flex-wrap items-start justify-between gap-3 rounded-ui border border-line p-4" key={address.id}>
        <div className="min-w-0">
          <p className="text-body font-bold text-ink">{address.title}{address.isDefault && <span className="ml-2 rounded-badge bg-surface-2 px-2 py-1 text-badge font-normal text-ink-2">по умолчанию</span>}</p>
          <p className="mt-1 text-body text-ink-2">{address.city}, {address.street}</p>
          {address.note && <p className="mt-1 text-meta text-ink-2">{address.note}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!address.isDefault && <button aria-label="Сделать основным" className={ghost} disabled={busy} onClick={async () => void (await run({ action: "default-address", id: address.id }))} type="button"><Star aria-hidden="true" size={16} /></button>}
          <button className={ghost} onClick={() => { setEditing(address); setAdding(false); setErrors({}); }} type="button">Изменить</button>
          <button aria-label="Удалить адрес" className={ghost} disabled={busy} onClick={async () => { if (window.confirm("Удалить этот адрес?")) void (await run({ action: "delete-address", id: address.id })); }} type="button"><Trash aria-hidden="true" size={16} /></button>
        </div>
      </li>)}
      {!addresses.length && !adding && <li className="text-body text-ink-2">Адресов пока нет.</li>}
    </ul>

    {editing ? form(editing) : adding ? form(null) : <button className={`mt-4 ${primary}`} onClick={() => { setAdding(true); setErrors({}); }} type="button">Добавить адрес</button>}
  </section>;
}

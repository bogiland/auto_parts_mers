"use client";
// Формы кабинета: личные данные, смена пароля и адреса. Все шлют запросы в /api/account.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Star, Trash } from "lucide-react";

import type { Address, Customer } from "@/lib/customer-db";

const field = "h-control w-full min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent";
const label = "block text-meta text-ink-2";
const primary = "h-control rounded-ui bg-accent px-6 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-60";
const ghost = "h-control rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent disabled:opacity-60";

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { message?: string; addresses?: Address[] };
  if (!response.ok) throw new Error(data.message ?? "Не удалось сохранить.");
  return data;
}

export function ProfileForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      await send({ action: "profile", name: form.get("name"), surname: form.get("surname"), email: form.get("email"), phone: form.get("phone") });
      setSaved(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="rounded-ui bg-white p-4 shadow-card md:p-6" onSubmit={submit}>
    <h2 className="text-block font-bold text-ink">Личные данные</h2>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className={label}>Имя<input className={`mt-1 ${field}`} defaultValue={customer.name} name="name" required /></label>
      <label className={label}>Фамилия<input className={`mt-1 ${field}`} defaultValue={customer.surname} name="surname" /></label>
      <label className={label}>Электронная почта<input className={`mt-1 ${field}`} defaultValue={customer.email} name="email" required type="email" /></label>
      <label className={label}>Телефон<input className={`mt-1 ${field}`} defaultValue={customer.phone} inputMode="tel" name="phone" required type="tel" /></label>
    </div>
    <p className="mt-3 text-meta text-ink-2">По этому телефону оператор подтверждает заказы. Если смените его, прошлые заказы останутся привязанными к старому номеру.</p>
    {error && <p className="mt-3 text-body text-accent" role="alert">{error}</p>}
    {saved && <p className="mt-3 text-body text-success" role="status">Сохранено</p>}
    <button className={`mt-4 ${primary}`} disabled={busy} type="submit">{busy ? "Сохраняем…" : "Продолжать"}</button>
  </form>;
}

export function PasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (String(form.get("password")) !== String(form.get("repeat"))) { setError("Новые пароли не совпадают."); return; }
    setBusy(true); setError("");
    try {
      await send({ action: "password", current: form.get("current"), password: form.get("password") });
      // Пароль сменён, все сессии закрыты — возвращаем на вход.
      router.replace("/login?next=/account");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сменить пароль.");
      setBusy(false);
    }
  }

  return <form className="rounded-ui bg-white p-4 shadow-card md:p-6" onSubmit={submit}>
    <h2 className="text-block font-bold text-ink">Изменить пароль</h2>
    <div className="mt-4 flex max-w-md flex-col gap-4">
      <label className={label}>Текущий пароль<input autoComplete="current-password" className={`mt-1 ${field}`} name="current" required type="password" /></label>
      <label className={label}>Новый пароль<input autoComplete="new-password" className={`mt-1 ${field}`} minLength={8} name="password" required type="password" /></label>
      <label className={label}>Повторите новый пароль<input autoComplete="new-password" className={`mt-1 ${field}`} minLength={8} name="repeat" required type="password" /></label>
    </div>
    <p className="mt-3 text-meta text-ink-2">После смены пароля вход на всех устройствах закроется — войдите заново.</p>
    {error && <p className="mt-3 text-body text-accent" role="alert">{error}</p>}
    <button className={`mt-4 ${primary}`} disabled={busy} type="submit">{busy ? "Меняем…" : "Сменить пароль"}</button>
  </form>;
}

export function AddressBook({ initial }: { initial: Address[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const data = await send(body);
      if (data.addresses) setAddresses(data.addresses);
      setEditing(null);
      setAdding(false);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({
      action: "save-address", id: editing?.id, title: form.get("title"), city: form.get("city"),
      street: form.get("street"), note: form.get("note"), isDefault: form.get("isDefault") === "on",
    });
  }

  const form = (address: Address | null) => <form className="mt-4 rounded-ui border border-line p-4" onSubmit={submit}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className={label}>Название адреса<input className={`mt-1 ${field}`} defaultValue={address?.title ?? ""} name="title" placeholder="Дом, работа" /></label>
      <label className={label}>Населённый пункт<input className={`mt-1 ${field}`} defaultValue={address?.city ?? ""} name="city" placeholder="Слободзея" required /></label>
      <label className={label}>Улица и дом<input className={`mt-1 ${field}`} defaultValue={address?.street ?? ""} name="street" placeholder="ул. Новосовицкая 25" required /></label>
      <label className={label}>Примечание для курьера<input className={`mt-1 ${field}`} defaultValue={address?.note ?? ""} name="note" placeholder="Подъезд, этаж, ориентир" /></label>
    </div>
    <label className="mt-3 flex gap-2 text-meta text-ink-2"><input defaultChecked={address?.isDefault ?? addresses.length === 0} name="isDefault" type="checkbox" />Использовать по умолчанию при оформлении заказа</label>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={primary} disabled={busy} type="submit">{busy ? "Сохраняем…" : "Сохранить адрес"}</button>
      <button className={ghost} onClick={() => { setEditing(null); setAdding(false); setError(""); }} type="button">Отмена</button>
    </div>
  </form>;

  return <section className="rounded-ui bg-white p-4 shadow-card md:p-6">
    <h2 className="text-block font-bold text-ink">Мои адреса</h2>
    <p className="mt-2 text-body text-ink-2">Адрес подставится в оформление заказа, если выберете доставку. Самовывоз адреса не требует.</p>
    {error && <p className="mt-3 text-body text-accent" role="alert">{error}</p>}

    <ul className="mt-4 flex flex-col gap-3">
      {addresses.map((address) => <li className="flex flex-wrap items-start justify-between gap-3 rounded-ui border border-line p-4" key={address.id}>
        <div className="min-w-0">
          <p className="text-body font-bold text-ink">{address.title}{address.isDefault && <span className="ml-2 rounded-badge bg-surface-2 px-2 py-1 text-badge font-normal text-ink-2">по умолчанию</span>}</p>
          <p className="mt-1 text-body text-ink-2">{address.city}, {address.street}</p>
          {address.note && <p className="mt-1 text-meta text-ink-2">{address.note}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!address.isDefault && <button aria-label="Сделать основным" className={ghost} disabled={busy} onClick={() => void run({ action: "default-address", id: address.id })} type="button"><Star aria-hidden="true" size={16} /></button>}
          <button className={ghost} onClick={() => { setEditing(address); setAdding(false); setError(""); }} type="button">Изменить</button>
          <button aria-label="Удалить адрес" className={ghost} disabled={busy} onClick={() => { if (window.confirm("Удалить этот адрес?")) void run({ action: "delete-address", id: address.id }); }} type="button"><Trash aria-hidden="true" size={16} /></button>
        </div>
      </li>)}
      {!addresses.length && !adding && <li className="text-body text-ink-2">Адресов пока нет.</li>}
    </ul>

    {editing ? form(editing) : adding ? form(null) : <button className={`mt-4 ${primary}`} onClick={() => { setAdding(true); setError(""); }} type="button">Добавить адрес</button>}
  </section>;
}

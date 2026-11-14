"use client";
// Заявка с уже подставленной машиной: покупателю остаётся телефон и название детали.

import { useState, type FormEvent } from "react";

export function DonorRequest({ vehicle }: { vehicle: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = new FormData(event.currentTarget);
    setSending(true); setError("");
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: form.get("phone"), part: form.get("part"), vehicle, source: "catalog" }) });
      if (!response.ok) { setError((await response.json().catch(() => ({}))).message ?? "Не удалось отправить заявку."); return; }
      setSubmitted(true);
    } catch { setError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  if (submitted) return <section className="rounded-ui bg-white p-4 shadow-card"><h2 className="text-block font-bold text-ink">Заявка принята</h2><p className="mt-2 text-body text-ink-2">Посмотрим, осталась ли эта деталь на машине, и перезвоним с 8:00 до 20:00.</p></section>;

  return <section className="rounded-ui bg-white p-4 shadow-card">
    <h2 className="text-block font-bold text-ink">Нужна другая деталь с этой машины</h2>
    <p className="mt-2 text-body text-ink-2">На складе есть не всё, что снято: напишите, что ищете, и мы посмотрим по этой машине. Машина уже подставлена в заявку.</p>
    {open
      ? <form className="mt-4 grid gap-2 md:grid-cols-3" onSubmit={submit}>
          <input aria-label="Машина" className="h-control min-w-0 rounded-ui border border-line bg-surface-2 px-3 text-body text-ink md:col-span-3" readOnly value={vehicle} />
          <input aria-label="Телефон" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" inputMode="tel" name="phone" placeholder="+373 68 123 456" required type="tel" />
          <input aria-label="Какая деталь нужна" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" name="part" placeholder="Какая деталь нужна" required />
          <button className="h-control rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50" disabled={sending} type="submit">{sending ? "Отправляем…" : "Отправить заявку"}</button>
          {error ? <p className="text-body text-accent md:col-span-3" role="alert">{error}</p> : null}
        </form>
      : <button className="mt-4 inline-flex h-btn items-center rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover" onClick={() => setOpen(true)} type="button">Запросить деталь с этой машины</button>}
  </section>;
}

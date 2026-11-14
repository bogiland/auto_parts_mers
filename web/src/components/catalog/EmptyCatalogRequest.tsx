"use client";

import { useState, type FormEvent } from "react";

export function EmptyCatalogRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = new FormData(event.currentTarget);
    setSending(true); setError("");
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: form.get("phone"), part: form.get("part"), vehicle: "", source: "catalog" }) });
      if (!response.ok) { setError((await response.json().catch(() => ({}))).message ?? "Не удалось отправить заявку."); return; }
      setSubmitted(true);
    } catch { setError("Нет связи с сервером. Повторите попытку."); }
    finally { setSending(false); }
  }

  if (submitted) return <section className="rounded-ui bg-white p-4"><h2 className="text-lead font-bold text-ink">Заявка принята</h2><p className="mt-2 text-body text-ink-2">Оператор свяжется с вами с 8:00 до 20:00.</p></section>;

  return <section className="rounded-ui bg-white p-4"><h2 className="text-lead font-bold text-ink">Эксперт поможет бесплатно</h2><p className="mt-2 text-body text-ink-2">Не нашли нужную деталь? Оставьте контакты, и мы уточним у оператора.</p><form className="mt-4 grid gap-2 md:grid-cols-3" onSubmit={submit}><input aria-label="Телефон" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" inputMode="tel" name="phone" placeholder="+373 68 123 456" required type="tel" /><input aria-label="Что требуется" className="h-control min-w-0 rounded-ui border border-line bg-white px-3 text-body text-ink outline-none focus:border-accent" name="part" placeholder="Что требуется" required /><button className="h-control rounded-ui bg-accent px-4 text-btn font-bold text-white hover:bg-accent-hover disabled:opacity-50" disabled={sending} type="submit">{sending ? "Отправляем…" : "Оставить заявку"}</button>{error ? <p className="text-body text-accent md:col-span-3" role="alert">{error}</p> : null}</form></section>;
}

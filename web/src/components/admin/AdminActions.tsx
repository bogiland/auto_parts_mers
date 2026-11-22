"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export function LogoutButtons() {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  async function leave(all: boolean) { setBusy(true); try { const response = await fetch(`/api/staff/logout${all ? "?all=1" : ""}`, { method: "POST" }); if (!response.ok) throw new Error(); localStorage.setItem("naa:staff-logout", String(Date.now())); router.replace("/admin/login"); router.refresh(); } finally { setBusy(false); } }
  return <div className="flex gap-3"><button disabled={busy} onClick={async () => (await leave(false))}>Выйти</button><button disabled={busy} onClick={async () => (await leave(true))}>Выйти на всех устройствах</button></div>;
}

export function AdminAction({ action, fields, children, onDone, submitLabel = "Сохранить" }: { action: string; fields: Record<string, string | number>; children: ReactNode; onDone?: () => void; submitLabel?: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setDone(false);
    if (action === "delete-user" && !window.confirm("Удалить сотрудника и отозвать его сессии?")) { setBusy(false); return; }
    const body: Record<string, string | number | File> = { ...fields, action, ...Object.fromEntries(new FormData(event.currentTarget).entries()) };
    if (action === "inventory") { body.price = Number(body.price); body.stock = Number(body.stock); }
    if (action === "cost") body.cost = Number(body.cost);
    try { const response = await fetch("/api/staff/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) { setError((await response.json().catch(() => ({}))).message ?? "Не удалось сохранить"); return; } setDone(true); onDone?.(); router.refresh(); }
    catch { setError("Не удалось сохранить. Попробуйте снова."); }
    finally { setBusy(false); }
  }
  return <form className="admin-form" onSubmit={submit}>{children}<button disabled={busy || !ready} type="submit">{busy ? "Сохраняем…" : submitLabel}</button>{error && <span className="w-full text-sm text-red-400" role="alert">{error}</span>}{done && <span className="w-full text-sm text-green-400" role="status">Сохранено</span>}</form>;
}

export function RevealPhone({ id, masked, inquiry = false }: { id: number; masked: string; inquiry?: boolean }) {
  const [phone, setPhone] = useState<string | null>(null); const [error, setError] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(frame); }, []);
  return <button className="text-accent underline" disabled={!ready} onClick={async () => { const response = await fetch("/api/staff/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: inquiry ? "reveal-inquiry" : "reveal", id }) }); if (response.ok) setPhone((await response.json()).phone); else setError(true); }} type="button">{error ? "Ошибка" : phone ?? masked}</button>;
}

export function CopyStatusLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="text-accent underline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/order/s/${token}`); setCopied(true); } catch { setCopied(false); } }} type="button">{copied ? "Ссылка скопирована" : "Скопировать ссылку на статус"}</button>;
}

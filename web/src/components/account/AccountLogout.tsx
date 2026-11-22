"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function AccountLogout() {
  const [busy, setBusy] = useState(false);
  return <button
    className="flex w-full items-center gap-3 p-4 text-left text-body text-ink hover:text-accent disabled:opacity-60"
    disabled={busy}
    onClick={async () => {
      setBusy(true);
      try {
        await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
        // Полная загрузка: внутренний переход оставил бы в шапке имя уже вышедшего покупателя.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- смена сессии требует полной загрузки
        window.location.assign("/");
      } catch {
        setBusy(false);
      }
    }}
    type="button"
  >
    <LogOut aria-hidden="true" className="shrink-0" size={20} strokeWidth={1.8} />
    <span>{busy ? "Выходим…" : "Выйти"}</span>
  </button>;
}

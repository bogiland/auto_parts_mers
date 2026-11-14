"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminSessionGuard() {
  const router = useRouter();
  useEffect(() => {
    async function check() {
      const response = await fetch("/api/staff/me", { cache: "no-store" }).catch(() => null);
      if (response?.status === 401) { router.replace("/admin/login"); router.refresh(); }
    }
    const onStorage = (event: StorageEvent) => { if (event.key === "naa:staff-logout") void check(); };
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("focus", check); window.removeEventListener("storage", onStorage); };
  }, [router]);
  return null;
}

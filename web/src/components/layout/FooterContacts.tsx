"use client";
import { useEffect, useState } from "react";
import { Clock3, MapPin } from "lucide-react";

type Settings = { phones: { pmr: string; moldova: string }; pickupAddress: string; pickupHours: string; operatorHours: string };
export function FooterContacts({ phones = false }: { phones?: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { fetch("/api/checkout/settings").then((response) => response.ok ? response.json() : null).then(setSettings).catch(() => {}); }, []);
  if (!settings) return <div className="mt-3 h-16 animate-pulse rounded bg-white/10" aria-label="Загрузка контактов" />;
  if (phones) return <div className="mt-3 space-y-2 text-body text-white/70"><a className="block hover:text-white" href={`tel:${settings.phones.pmr}`}>ПМР: {settings.phones.pmr}</a><a className="block hover:text-white" href={`tel:${settings.phones.moldova}`}>Молдова: {settings.phones.moldova}</a><p>Оператор: {settings.operatorHours}</p></div>;
  return <address className="mt-3 not-italic text-body text-white/70"><p className="flex gap-2"><MapPin size={18} />{settings.pickupAddress}</p><p className="mt-3 flex gap-2"><Clock3 size={18} />{settings.pickupHours}</p></address>;
}

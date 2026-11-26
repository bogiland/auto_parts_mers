"use client";

// Клиентский компонент: запоминает машину в браузере и сбрасывает её без перезагрузки.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { rememberCar } from "@/lib/selected-car-shared";

/** Машина пришла в адресе — запоминаем её, чтобы она не потерялась на следующей странице. */
export function RememberCar({ car, explicit }: { car: { slug: string; label: string } | null; explicit: boolean }) {
  useEffect(() => { if (explicit) rememberCar(car); }, [car, explicit]);
  return null;
}

/** Плашка «W212 2013 · сменить» над выдачей. */
export function CarPlaque({ car, resetHref }: { car: { slug: string; label: string; year: string }; resetHref: string }) {
  const router = useRouter();
  return <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-ui bg-surface-2 px-3 py-2 text-body text-ink" data-car-plaque={car.slug}>
    <span className="min-w-0 break-words"><span className="text-ink-2">Ваша машина: </span><b>{car.label}{car.year ? ` ${car.year}` : ""}</b></span>
    <span aria-hidden="true" className="text-ink-3">·</span>
    <Link className="text-accent hover:text-accent-hover" href="/#car-picker">сменить</Link>
    <button className="text-ink-2 hover:text-accent" onClick={() => { rememberCar(null); router.push(resetHref); }} type="button">сбросить</button>
  </div>;
}

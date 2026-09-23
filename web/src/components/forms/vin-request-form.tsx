"use client";

import { ScanLine } from "lucide-react";
import { type FormEvent, useState } from "react";

const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;

export function VinRequestForm() {
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setStatus(vinPattern.test(vin.trim().toUpperCase()) ? "success" : "error"); };
  return <section className="vin-panel" aria-labelledby="vin-title"><div className="vin-panel__copy"><h2 id="vin-title">Найдите запчасть по VIN</h2><p>Введите VIN автомобиля, и мы поможем подобрать подходящую деталь.</p></div><form className="vin-panel__form" noValidate onSubmit={submit}><label className="sr-only" htmlFor="vin">VIN или номер кузова</label><div className="vin-panel__input"><input autoComplete="off" id="vin" onChange={(event) => { setVin(event.target.value); setStatus("idle"); }} placeholder="VIN или номер кузова" value={vin} /><ScanLine aria-hidden="true" size={21} strokeWidth={1.8} /></div><button className="button button--red" type="submit">Найти</button></form>{status === "error" ? <p className="vin-panel__status vin-panel__status--error">Введите VIN из 17 символов.</p> : null}{status === "success" ? <p className="vin-panel__status">Заявка принята. Мы свяжемся с вами.</p> : null}</section>;
}

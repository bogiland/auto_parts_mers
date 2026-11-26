"use client";

// Клиентский компонент: общие части форм заявок — подтверждение, ошибка, мессенджеры.
import { CheckCircle2 } from "lucide-react";

import { replyPromise } from "@/lib/working-hours";

/** Номер для мессенджеров из задания владельца. Viber и Telegram открываются сразу в чате. */
export const messengerPhone = "+37377745636";
export const messengerPhoneLabel = "+373 777 45 636";

export function ContactLine() {
  return <div className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-ink-2">
    <span>Пишите на русском или румынском:</span>
    <a className="inline-flex h-8 items-center rounded-ui border border-line bg-white px-3 font-bold text-ink hover:text-accent" href={`viber://chat?number=${encodeURIComponent(messengerPhone)}`}>Viber</a>
    <a className="inline-flex h-8 items-center rounded-ui border border-line bg-white px-3 font-bold text-ink hover:text-accent" href={`https://t.me/${messengerPhone}`} rel="noreferrer" target="_blank">Telegram</a>
    <span>{messengerPhoneLabel}</span>
  </div>;
}

/** Ошибка формы — одним стилем во всех формах, вместо системного «Заполните это поле». */
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-ui bg-accent/10 px-3 py-2 text-body text-accent" role="alert">{message}</p>;
}

/** Заметное подтверждение отправки. */
export function SentNotice({ afterHours, title = "Заявка принята", children }: { afterHours: boolean; title?: string; children?: React.ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-ui border border-success bg-white p-4" role="status">
    <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-success" size={24} />
    <div className="min-w-0">
      <p className="text-lead font-bold text-ink">{title}</p>
      <p className="mt-1 text-body text-ink-2" data-reply-promise>{replyPromise(afterHours)}</p>
      {children}
    </div>
  </div>;
}

/**
 * Проверка обязательных полей своим текстом. Формы помечены noValidate, поэтому браузер
 * не показывает своё «Заполните это поле»; вместо этого первое пустое поле получает фокус,
 * а сообщение выводится в FormError. Текст берётся из data-error поля.
 */
export function firstMissing(form: HTMLFormElement): string {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    if (element instanceof HTMLInputElement && element.type === "hidden") continue;
    const empty = element instanceof HTMLInputElement && element.type === "checkbox" ? !element.checked : !String(element.value).trim();
    const invalid = element.required && empty;
    element.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (invalid) { element.focus(); return element.dataset.error || "Заполните отмеченные поля."; }
  }
  return "";
}

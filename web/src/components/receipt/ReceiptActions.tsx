"use client";
// Печать и копирование ссылки: отсюда получается и бумажный чек, и PDF через «Сохранить как PDF» в окне печати.

import { Copy, Printer } from "lucide-react";
import { useEffect, useState } from "react";

export function ReceiptActions({ autoPrint = false }: { autoPrint?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint]);
  return <div className="receipt-actions flex flex-wrap gap-2">
    <button className="inline-flex h-btn items-center gap-2 rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" onClick={() => window.print()} type="button"><Printer aria-hidden="true" size={16} />Распечатать или сохранить PDF</button>
    <button className="inline-flex h-btn items-center gap-2 rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { setCopied(false); } }} type="button"><Copy aria-hidden="true" size={16} />{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
  </div>;
}

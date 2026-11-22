"use client";

import { Headset, MessageCircle, Send, X } from "lucide-react";
import { useId, useRef, useState } from "react";

export function SupportLauncher({ telegram, whatsapp }: { telegram: string; whatsapp: string }) {
  const [open, setOpen] = useState(false);
  const linksId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const links = [
    { title: "Telegram", href: telegram, Icon: Send },
    { title: "WhatsApp", href: whatsapp, Icon: MessageCircle },
  ].filter(({ href }) => href);

  if (!links.length) return null;

  return (
    <div className="support-launcher fixed right-4 z-40 flex flex-col items-center gap-2 desktop:bottom-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}>
      <button aria-controls={linksId} aria-expanded={open} aria-label={open ? "Закрыть поддержку" : "Связаться с поддержкой"}
        className="order-last grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-card" onClick={() => setOpen(!open)} ref={button} type="button">
        {open ? <X aria-hidden="true" size={24} /> : <Headset aria-hidden="true" size={24} />}
      </button>
      <div aria-hidden={!open} className={`flex flex-col gap-2 transition motion-reduce:transition-none ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`} id={linksId} inert={!open}>
        {links.map(({ title, href, Icon }) => (
          <a aria-label={title} className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white text-ink shadow-card hover:text-accent"
            href={href} key={title} rel="noopener noreferrer" target="_blank" title={title}>
            <Icon aria-hidden="true" size={20} />
          </a>
        ))}
      </div>
    </div>
  );
}

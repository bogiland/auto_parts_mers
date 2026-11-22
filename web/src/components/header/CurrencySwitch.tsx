"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

const key = "naa:currency";
const subscribe = (notify: () => void) => { window.addEventListener("storage", notify); window.addEventListener("naa:currency", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("naa:currency", notify); }; };
const snapshot = () => { try { return localStorage.getItem(key) === "mdl" ? "mdl" : "rub"; } catch { return "rub"; } };
const serverSnapshot = () => "rub";
export function useCurrency() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
export function CurrencySwitch() {
  const currency = useCurrency();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const options = [{ value: "rub", label: "руб. ПМР" }, { value: "mdl", label: "MDL" }];

  function select(value: string) {
    try {
      localStorage.setItem(key, value);
      window.dispatchEvent(new Event("naa:currency"));
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    } finally {
      setOpen(false);
      trigger.current?.focus();
    }
  }

  return <div className="flex shrink-0 items-center gap-2 text-meta text-white">
    <span className="hidden desktop:inline">Валюта</span>
    <div className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" aria-label={`Валюта: ${currency === "rub" ? "руб. ПМР" : "MDL"}`} aria-expanded={open} aria-controls={open ? menuId : undefined} className="flex items-center gap-2 rounded-r-12 border border-ink-2 bg-header px-3 py-1 hover:bg-header-dark" onClick={() => setOpen(!open)}>
        {currency === "rub" ? "руб. ПМР" : "MDL"} <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div id={menuId} role="group" aria-label="Доступные валюты" className="absolute right-0 top-full z-50 mt-2 grid min-w-full gap-1 rounded-r-12 border border-ink-2 bg-header p-1 shadow-card">
        {options.map(({ value, label }) => <button key={value} type="button" aria-pressed={currency === value} onClick={() => select(value)} className={`whitespace-nowrap rounded-ui px-3 py-2 text-left hover:bg-header-dark ${currency === value ? "bg-header-dark font-bold" : ""}`}>{label}</button>)}
      </div>}
    </div>
  </div>;
}

"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { type ChangeEvent, useMemo, useState } from "react";

const countries = [
  { code: "+373", flag: "🇲🇩", iso: "MD" as CountryCode, label: "Молдова" },
  { code: "+40", flag: "🇷🇴", iso: "RO" as CountryCode, label: "Румыния" },
  { code: "+380", flag: "🇺🇦", iso: "UA" as CountryCode, label: "Украина" },
  { code: "+7", flag: "🇷🇺", iso: "RU" as CountryCode, label: "Россия" },
  { code: "+39", flag: "🇮🇹", iso: "IT" as CountryCode, label: "Италия" },
  { code: "+49", flag: "🇩🇪", iso: "DE" as CountryCode, label: "Германия" },
  { code: "+972", flag: "🇮🇱", iso: "IL" as CountryCode, label: "Израиль" },
  { code: "+90", flag: "🇹🇷", iso: "TR" as CountryCode, label: "Турция" },
] as const;

type Country = (typeof countries)[number];

interface PhoneInputProps {
  onValueChange: (value: string, isValid: boolean) => void;
  showError?: boolean;
}

function nationalDigits(value: string, country: Country) {
  const digits = value.replace(/\D/g, "");
  return country.iso === "MD" && digits.startsWith("0") ? digits.slice(1, 9) : digits.slice(0, 14);
}

function displayNationalNumber(value: string, country: Country) {
  if (country.iso !== "MD") return value;
  const groups = [value.slice(0, 2), value.slice(2, 5), value.slice(5, 8)].filter(Boolean);
  return groups.join(" ");
}

function resolvePastedNumber(value: string, fallback: Country) {
  const parsed = parsePhoneNumberFromString(value, fallback.iso);
  const detected = parsed ? countries.find((country) => country.iso === parsed.country) : undefined;
  const country = detected ?? fallback;
  const national = parsed ? parsed.nationalNumber : nationalDigits(value, country);
  return { country, national: nationalDigits(national, country) };
}

export function PhoneInput({ onValueChange, showError = false }: PhoneInputProps) {
  const [country, setCountry] = useState<Country>(countries[0]);
  const [national, setNational] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isTouched, setIsTouched] = useState(false);

  const e164 = national ? `${country.code}${national}` : "";
  const valid = Boolean(e164) && isValidPhoneNumber(e164);
  const visibleCountries = useMemo(() => countries.filter((item) => `${item.label} ${item.code}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const showValidationError = (isTouched || showError) && Boolean(national) && !valid;

  function updateValue(nextCountry: Country, nextNational: string) {
    const normalized = nationalDigits(nextNational, nextCountry);
    setCountry(nextCountry);
    setNational(normalized);
    const value = normalized ? `${nextCountry.code}${normalized}` : "";
    onValueChange(value, Boolean(value) && isValidPhoneNumber(value));
  }

  function handleNumberChange(event: ChangeEvent<HTMLInputElement>) {
    const next = resolvePastedNumber(event.target.value, country);
    updateValue(next.country, next.national);
  }

  return (
    <div className="min-w-0">
      <div className={`relative flex h-control min-w-0 rounded-ui border bg-white ${isFocused ? "border-accent" : "border-line"}`}>
        <div className="relative flex shrink-0 border-r border-line">
          <button aria-expanded={isOpen} aria-haspopup="listbox" className="flex items-center gap-1 px-3 text-body font-medium text-ink hover:bg-surface-2" onClick={() => setIsOpen((open) => !open)} type="button">
            <span aria-hidden="true">{country.flag}</span><span>{country.code}</span><ChevronDown aria-hidden="true" size={16} />
          </button>
          {isOpen ? <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-ui border border-line bg-white p-2 shadow-card">
            <label className="flex h-10 items-center gap-2 rounded-ui border border-line px-3 text-ink-2"><Search aria-hidden="true" size={16} /><span className="sr-only">Поиск страны</span><input autoFocus className="min-w-0 flex-1 outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Поиск страны" value={query} /></label>
            <div className="mt-2 max-h-60 overflow-y-auto" role="listbox">
              {visibleCountries.map((item) => <button aria-selected={item.iso === country.iso} className="flex w-full items-center justify-between gap-3 rounded-ui px-3 py-2 text-left text-body text-ink hover:bg-surface-2" key={item.iso} onClick={() => { updateValue(item, national); setIsOpen(false); setQuery(""); }} role="option" type="button"><span>{item.flag} {item.label} {item.code}</span>{item.iso === country.iso ? <Check aria-hidden="true" className="text-accent" size={16} /> : null}</button>)}
            </div>
          </div> : null}
        </div>
        <input aria-label="Номер телефона" autoComplete="tel-national" className="min-w-0 flex-1 rounded-r-ui px-3 text-body text-ink outline-none placeholder:text-ink-3" inputMode="tel" onBlur={() => { setIsFocused(false); setIsTouched(true); }} onChange={handleNumberChange} onFocus={() => setIsFocused(true)} placeholder="68 123 456" required type="tel" value={displayNationalNumber(national, country)} />
      </div>
      {showValidationError ? <p className="mt-1 text-meta text-accent">Проверьте номер телефона.</p> : null}
    </div>
  );
}

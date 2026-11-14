"use client";
// Карта грузится только после нажатия: до этого OpenStreetMap не видит посетителя и не получает его адрес.

import { MapPin } from "lucide-react";
import { useState } from "react";

export function PageMap({ address }: { address: string }) {
  const [shown, setShown] = useState(false);
  const query = encodeURIComponent(address);
  const external = `https://www.openstreetmap.org/search?query=${query}`;
  return <div className="mt-4 rounded-ui bg-white p-4 shadow-card">
    <h2 className="text-block font-bold text-ink">Как нас найти</h2>
    <p className="mt-2 flex gap-2 text-body text-ink"><MapPin aria-hidden="true" className="shrink-0 text-accent" size={18} />{address}</p>
    {shown
      ? <div className="mt-3 overflow-hidden rounded-ui border border-line">
          <iframe className="block h-64 w-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=29.65%2C46.70%2C29.75%2C46.76&layer=mapnik`} title={`Карта: ${address}`} />
        </div>
      : <button className="mt-3 inline-flex h-btn w-full items-center justify-center rounded-ui border border-line px-4 text-btn font-bold text-ink hover:border-accent hover:text-accent" onClick={() => setShown(true)} type="button">Показать карту</button>}
    <a className="mt-2 inline-block text-meta text-ink-2 hover:text-accent" href={external} rel="noreferrer" target="_blank">Открыть в OpenStreetMap</a>
  </div>;
}

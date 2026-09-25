const brands = ["Mercedes-Benz Original", "Bosch", "Mann-Filter", "Brembo", "Lemförder", "TRW", "Febi", "Mahle", "Sachs", "Hella", "Varta", "Mobil 1"];

export function BrandRail() {
  return <section aria-labelledby="brands-title" className="min-w-0"><h2 className="mb-4 text-section font-bold text-ink" id="brands-title">Популярные бренды</h2><div className="scroller-x min-w-0 gap-2 xl:grid xl:grid-cols-6 xl:gap-4">{brands.map((brand) => <div className="flex min-w-0 shrink-0 basis-[calc((100%-16px)/3)] items-center justify-center rounded-ui bg-surface-2 p-4 text-center xl:aspect-[209/100] xl:basis-auto" key={brand}><span className="text-body font-bold text-ink grayscale transition hover:grayscale-0">{brand}</span></div>)}</div></section>;
}

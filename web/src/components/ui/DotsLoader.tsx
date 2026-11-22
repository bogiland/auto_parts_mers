// Пока страница не готова, вместо полупустой вёрстки показываются тёмные полосы шапки и подвала
// и три точки, которые по очереди вырастают волной. Так не мелькает «не то» содержимое.

export function DotsLoader({ label = "Загружаем…", light = false }: { label?: string; light?: boolean }) {
  return <div aria-live="polite" className="dots-loader flex items-center justify-center gap-2" role="status">
    {[0, 1, 2].map((index) => <span className={`block h-3 w-3 rounded-full ${light ? "bg-white" : "bg-header-dark"}`} key={index} />)}
    <span className="sr-only">{label}</span>
  </div>;
}

/** Заглушка целой страницы: тёмная шапка, точки вместо содержимого, тёмный подвал. */
export function PageSkeleton({ label }: { label?: string }) {
  return <>
    <div aria-hidden="true" className="bg-header-dark"><div className="container-site flex h-8 items-center"><DotsLoader light /></div></div>
    <div aria-hidden="true" className="bg-header"><div className="container-site h-control" /></div>
    <main className="container-site section-stack">
      <div className="flex min-h-control items-center justify-center rounded-ui bg-white p-8 shadow-card"><DotsLoader label={label} /></div>
    </main>
    <div aria-hidden="true" className="bg-header-dark"><div className="container-site flex h-control items-center"><DotsLoader light /></div></div>
  </>;
}

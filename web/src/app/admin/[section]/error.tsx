"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="admin-shell grid place-items-center p-5"><div className="admin-card"><h1>Не удалось загрузить раздел</h1><p className="admin-muted">Проверьте соединение и попробуйте снова.</p><button className="admin-button" onClick={reset}>Повторить</button></div></main>;
}

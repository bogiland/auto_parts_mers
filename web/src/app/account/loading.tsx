import { DotsLoader } from "@/components/ui/DotsLoader";

// Вкладки кабинета читают базу на сервере. Пока ответ не пришёл, вместо пустого места
// показываются три точки — содержимое не появляется рывком.
export default function AccountLoading() {
  return <main className="container-site section-stack">
    <div className="flex min-h-control items-center justify-center rounded-ui bg-white p-8 shadow-card">
      <DotsLoader label="Открываем кабинет…" />
    </div>
  </main>;
}

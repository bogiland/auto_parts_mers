import Link from "next/link";
import type { ReactNode } from "react";
import { Heart, Lock, Pencil, ShoppingCart, Truck, UserRound } from "lucide-react";

import { AccountLogout } from "./AccountLogout";

const menu = [
  { href: "/account", label: "Мой кабинет", icon: UserRound },
  { href: "/account/edit", label: "Редактировать информацию об учётной записи", icon: Pencil },
  { href: "/account/password", label: "Изменить пароль", icon: Lock },
  { href: "/account/addresses", label: "Мои адреса", icon: Truck },
  { href: "/favorites", label: "Список желаний", icon: Heart },
  { href: "/account/orders", label: "История заказов", icon: ShoppingCart },
];

export function AccountShell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  return <main className="container-site section-stack">
    <section className="min-w-0">
      <p className="text-meta text-ink-2"><Link className="hover:text-accent" href="/">Главная</Link> / <Link className="hover:text-accent" href="/account">Кабинет</Link>{active === "/account" ? "" : ` / ${title}`}</p>
      <h1 className="mt-2 text-section font-bold text-ink">{title}</h1>
    </section>

    <section className="grid grid-cols-1 gap-6 desktop:grid-cols-3">
      <div className="min-w-0 desktop:col-span-2">{children}</div>
      <nav aria-label="Разделы кабинета" className="min-w-0">
        <ul className="overflow-hidden rounded-ui bg-white shadow-card">
          {menu.map((item) => {
            const Icon = item.icon;
            const current = item.href === active;
            return <li className="border-b border-line last:border-b-0" key={item.href}>
              <Link aria-current={current ? "page" : undefined} className={`flex items-center gap-3 p-4 text-body ${current ? "font-bold text-accent" : "text-ink hover:text-accent"}`} href={item.href}>
                <Icon aria-hidden="true" className="shrink-0" size={20} strokeWidth={1.8} />
                <span className="min-w-0">{item.label}</span>
              </Link>
            </li>;
          })}
          <li className="border-t border-line"><AccountLogout /></li>
        </ul>
      </nav>
    </section>
  </main>;
}

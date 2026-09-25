import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, Camera, ChevronDown, CirclePlay, Clock3, CreditCard, Mail, MapPin, MessageCircle, Send } from "lucide-react";
import type { ReactNode } from "react";

const companyLinks = [["О компании", "/about"], ["Вакансии", "/vacancies"], ["Новости", "/media"], ["Отзывы клиентов", "/reviews"]] as const;
const buyerLinks = [["Доставка", "/delivery"], ["Оплата", "/payment"], ["Возврат", "/returns"], ["Гарантия", "/warranty"]] as const;
const categoryLinks = [["Автозапчасти", "/catalog"], ["Масла и жидкости", "/catalog/filters"], ["Аксессуары", "/catalog/accessories"], ["Инструменты", "/catalog/accessories"], ["Тюнинг", "/catalog/accessories"]] as const;

const socialLinks = [
  { label: "Telegram", href: "#telegram", icon: Send },
  { label: "Instagram", href: "#instagram", icon: Camera },
  { label: "YouTube", href: "#youtube", icon: CirclePlay },
  { label: "Написать нам", href: "#messenger", icon: MessageCircle },
] as const;

function FooterLinkList({ links }: { links: readonly (readonly [string, string])[] }) {
  return <nav className="mt-4 flex flex-col gap-2">{links.map(([label, href]) => <Link className="text-lead text-white/60 hover:text-white" href={href} key={label}>{label}</Link>)}</nav>;
}

function ContactList() {
  return <address className="mt-4 not-italic text-lead text-white/60"><p className="flex gap-2"><MapPin aria-hidden="true" className="shrink-0" size={20} />Слободзея, ул. Новосовицкая 25</p><a className="mt-2 flex gap-2 hover:text-white" href="mailto:info@naa.md"><Mail aria-hidden="true" className="shrink-0" size={20} />info@naa.md</a><p className="mt-2 flex gap-2"><Clock3 aria-hidden="true" className="shrink-0" size={20} />Пн–Сб 09:00–18:00</p></address>;
}

function SocialsAndPayment() {
  return <div className="mt-4"><a className="text-phone-lg font-bold text-white/90 hover:text-white" href="tel:+37368123456">+373 68 123 456</a><div className="mt-4 flex gap-2">{socialLinks.map(({ label, href, icon: Icon }) => <a aria-label={label} className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-white/60 hover:border-white hover:text-white" href={href} key={label}><Icon aria-hidden="true" size={18} /></a>)}</div><div className="mt-4 flex items-center gap-2 text-white/60"><CreditCard aria-hidden="true" size={24} /><span className="text-meta">Мы принимаем к оплате</span></div></div>;
}

function MobileFooterSection({ children, title }: { children: ReactNode; title: string }) {
  return <details className="group border-b border-white/10"><summary className="flex h-12 cursor-pointer list-none items-center justify-between text-accent"><span className="text-body font-bold">{title}</span><ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" size={20} /></summary><div className="pb-4">{children}</div></details>;
}

export function SiteFooter() {
  return (
    <footer className="bg-header pb-tabbar text-white xl:bg-header-top xl:pb-0">
      <section className="bg-surface-2 py-6 text-ink"><div className="container-site flex flex-wrap items-center gap-6"><BriefcaseBusiness aria-hidden="true" className="text-accent" size={24} /><strong className="text-body font-bold">Присоединяйтесь к команде</strong><Image alt="NAA.md" className="h-[22px] w-auto" height={22} src="/images/brand/naa-logo.png" width={120} /><Link className="inline-flex h-btn items-center rounded-ui border border-accent px-4 text-btn font-bold text-accent hover:bg-accent hover:text-white" href="/vacancies">Смотреть вакансии</Link></div></section>
      <section className="bg-header py-6"><div className="container-site"><h2 className="text-body font-bold text-white">О компании</h2><div className="mt-4 space-y-2 text-meta text-white/60"><p>NAA.md — интернет-магазин автозапчастей в Молдове. В каталоге собраны детали, расходные материалы, масла, аксессуары и проверенные аналоги для обслуживания, ремонта и дооснащения автомобиля.</p><p>Подберите нужную запчасть по модели или обратитесь к эксперту: специалист поможет уточнить совместимость, сориентироваться в ассортименте и оформить заказ без лишних сложностей.</p><p>Мы работаем для владельцев автомобилей в Слободзее и по Молдове, уделяя внимание понятному подбору, актуальному ассортименту и удобному сервису.</p></div></div></section>
      <div className="container-site py-8">
        <div className="hidden grid-cols-5 gap-8 xl:grid">
          <section><Link aria-label="NAA.md" href="/"><Image alt="NAA.md" className="h-[22px] w-auto" height={22} src="/images/brand/naa-logo.png" width={120} /></Link><FooterLinkList links={companyLinks} /></section>
          <section><h2 className="text-lead font-bold text-white">Покупателям</h2><FooterLinkList links={buyerLinks} /></section>
          <section><h2 className="text-lead font-bold text-white">Категории</h2><FooterLinkList links={categoryLinks} /></section>
          <section><h2 className="text-lead font-bold text-white">Контакты</h2><ContactList /></section>
          <section><h2 className="text-lead font-bold text-white">Телефон и соцсети</h2><SocialsAndPayment /></section>
        </div>
        <div className="xl:hidden"><Link aria-label="NAA.md" className="mb-4 inline-block" href="/"><Image alt="NAA.md" className="h-[22px] w-auto" height={22} src="/images/brand/naa-logo.png" width={120} /></Link><MobileFooterSection title="О компании"><FooterLinkList links={companyLinks} /></MobileFooterSection><MobileFooterSection title="Покупателям"><FooterLinkList links={buyerLinks} /></MobileFooterSection><MobileFooterSection title="Категории"><FooterLinkList links={categoryLinks} /></MobileFooterSection><MobileFooterSection title="Контакты"><ContactList /></MobileFooterSection><SocialsAndPayment /></div>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 py-4 text-meta text-white/60 md:flex-row md:items-center md:justify-between"><span>© 2026 NAA.md. Все права защищены.</span><div className="flex gap-4"><Link href="/terms">Условия использования</Link><Link href="/privacy">Политика конфиденциальности</Link></div></div>
      </div>
    </footer>
  );
}

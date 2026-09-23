import Link from "next/link";
import { Camera, CirclePlay, Clock3, Headset, Mail, MapPin, MessageCircle, Send } from "lucide-react";

const footerGroups = [
  { title: "Информация", links: [["О компании", "/about"], ["Контакты", "/contacts"], ["Вакансии", "/vacancies"], ["Новости", "/media"], ["Отзывы клиентов", "/reviews"]] },
  { title: "Покупателям", links: [["Доставка", "/delivery"], ["Оплата", "/payment"], ["Возврат", "/returns"], ["Гарантия", "/warranty"], ["Реклама на сайте", "/advertising"]] },
  { title: "Категории", links: [["Автозапчасти", "/catalog"], ["Масла и жидкости", "/catalog/filters"], ["Аксессуары", "/catalog/accessories"], ["Инструменты", "/catalog/accessories"], ["Тюнинг", "/catalog/accessories"]] },
] as const;

const socialLinks = [
  { label: "Telegram", href: "#telegram", icon: Send },
  { label: "Instagram", href: "#instagram", icon: Camera },
  { label: "YouTube", href: "#youtube", icon: CirclePlay },
  { label: "Написать нам", href: "#messenger", icon: MessageCircle },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div className="site-footer__brand">
          <Link aria-label="NAA.md" className="site-footer__logo" href="/">NAA<span>.md</span></Link>
          <p>Автозапчасти для вашего автомобиля</p>
          <div className="site-footer__support"><Headset aria-hidden="true" size={27} strokeWidth={1.7} /><div><strong>Техническая поддержка</strong><span>Ответим на все ваши вопросы</span></div></div>
        </div>
        {footerGroups.map((group) => <section className="site-footer__links" key={group.title}><h2>{group.title}</h2>{group.links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</section>)}
        <section className="site-footer__contacts"><h2>Наши контакты</h2><p><MapPin aria-hidden="true" size={19} /><span>Слободзея, ул. Новосовицкая 25</span></p><p><Mail aria-hidden="true" size={19} /><a href="mailto:info@naa.md">info@naa.md</a></p><p><Clock3 aria-hidden="true" size={19} /><span>Пн–Сб 09:00–18:00</span></p></section>
        <section className="site-footer__socials"><h2>Мы в социальных сетях</h2><p>Новости, новые поступления и ответы на вопросы.</p><div>{socialLinks.map(({ label, href, icon: Icon }) => <a aria-label={label} href={href} key={label}><Icon size={18} strokeWidth={1.8} /></a>)}</div></section>
        <div className="site-footer__bottom"><span>© 2026 NAA.md. Все права защищены.</span><div><a href="/terms">Условия использования</a><a href="/privacy">Политика конфиденциальности</a></div></div>
      </div>
    </footer>
  );
}

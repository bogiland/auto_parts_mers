"use client";

import { Headset, Send, Wrench } from "lucide-react";
import { type FormEvent, useState } from "react";

export function ExpertRequestForm() {
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="expert-request" aria-labelledby="expert-request-title">
      <h2 id="expert-request-title">Сомневаетесь в самостоятельном подборе?</h2>
      <div className="expert-request__body">
        <aside className="expert-request__intro">
          <div aria-hidden="true" className="expert-request__support-icon"><Headset size={34} strokeWidth={1.7} /></div>
          <div>
            <h3>Эксперт поможет подобрать запчасти бесплатно</h3>
            <p>Уточнит совместимость и перезвонит в течение 15 минут.</p>
          </div>
        </aside>
        <form className="expert-request__form" onSubmit={submit}>
          <label>
            <span>Ваш телефон</span>
            <input autoComplete="tel" inputMode="tel" name="phone" placeholder="+373 68 123 456" required type="tel" />
          </label>
          <label>
            <span>Что ищете</span>
            <div className="expert-request__field-with-icon"><Wrench aria-hidden="true" size={15} /><input name="part" placeholder="Например, тормозные колодки" required /></div>
          </label>
          <label>
            <span>Автомобиль</span>
            <input name="vehicle" placeholder="Марка, модель, год" />
          </label>
          <div className="expert-request__submit">
            <button className="button button--red" type="submit"><Send aria-hidden="true" size={16} />Отправить заявку</button>
            <p>{submitted ? "Заявка принята. Эксперт скоро свяжется с вами." : "Отправляя заявку, вы соглашаетесь с обработкой персональных данных."}</p>
          </div>
        </form>
      </div>
    </section>
  );
}

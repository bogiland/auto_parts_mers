"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { clearCart, useCart } from "@/lib/cart-store";
import type { CheckoutSettings, OrderResult } from "@/lib/checkout-db";
import { OrderReceipt } from "./OrderReceipt";
import { formatRub } from "@/lib/money";

type CatalogItem = { id: string; name: string; priceMdl: number | null; priceRub: number | null; stock: number; priceMode: string; returnRestricted: boolean };
type Field = "name" | "phone" | "contactMethod" | "deliveryMethod" | "address" | "paymentMethod" | "comment" | "agreed" | "restrictedAgreed" | "items" | "submit";
const money = formatRub;
const itemWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? "товар" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "товара" : "товаров";

export function CheckoutPage() {
  const cart = useCart();
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [contactMethod, setContactMethod] = useState("call");
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("receipt");
  const [comment, setComment] = useState("");
  const agreed = true;
  const [restrictedAgreed, setRestrictedAgreed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [account, setAccount] = useState<{ name: string; surname: string; phone: string } | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    Promise.all([fetch("/api/checkout/settings", { cache: "no-store" }), fetch("/api/checkout/catalog", { cache: "no-store" })])
      .then(async ([settingsResponse, catalogResponse]) => {
        if (!settingsResponse.ok || !catalogResponse.ok) throw new Error("load");
        setSettings(await settingsResponse.json() as CheckoutSettings);
        setCatalog(await catalogResponse.json() as CatalogItem[]);
      }).catch(() => setLoadError(true));
  }, []);

  // Вошедшему покупателю не нужно вводить имя, телефон и адрес заново.
  useEffect(() => {
    fetch("/api/account/me", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: { customer: { name: string; surname: string; phone: string } | null; addresses?: { street: string; city: string; isDefault: boolean }[] } | null) => {
        if (!data?.customer) return;
        setAccount(data.customer);
        setName((current) => current || [data.customer!.name, data.customer!.surname].filter(Boolean).join(" "));
        setPhone((current) => current || data.customer!.phone);
        const preferred = data.addresses?.find((item) => item.isDefault) ?? data.addresses?.[0];
        if (preferred) setAddress((current) => current || `${preferred.city}, ${preferred.street}`);
      })
      .catch(() => { /* кабинет не обязателен: заказ оформляется и без входа */ });
  }, []);

  // Ошибка исчезает, как только поле исправлено: показываем только ошибки полей, которые всё ещё не заполнены.
  // Считается при отрисовке, без эффекта, — отдельный setState в эффекте давал лишнюю перерисовку.
  const shownErrors: Partial<Record<Field, string>> = { ...errors };
  if (shownErrors.name && name.trim().length >= 2) delete shownErrors.name;
  if (shownErrors.phone && phoneValid) delete shownErrors.phone;
  if (shownErrors.address && address.trim()) delete shownErrors.address;
  if (shownErrors.restrictedAgreed && restrictedAgreed) delete shownErrors.restrictedAgreed;

  if (order) return <OrderReceipt order={order} />;
  const byId = new Map(catalog?.map((item) => [item.id, item]));
  const rows = cart.items.map((item) => ({ item, product: byId.get(item.id) }));
  const invalidStock = Boolean(catalog && rows.some(({ item, product }) => !product || product.priceMode !== "fixed" || product.priceMdl === null || product.stock < item.quantity));
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = rows.reduce((sum, { item, product }) => sum + (product?.priceMdl ?? 0) * item.quantity, 0);
  const restricted = rows.some(({ product }) => product?.returnRestricted);
  const selectedDelivery = settings?.deliveryMethods.find((option) => option.id === deliveryMethod);
  const error = (field: Field) => shownErrors[field] ? <p className="mt-1 text-meta text-accent" role="alert">{shownErrors[field]}</p> : null;


  function focusError(field: Field) {
    window.requestAnimationFrame(() => document.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) next.name = "Укажите имя.";
    if (!phoneValid) next.phone = "Проверьте номер телефона.";
    if (selectedDelivery?.needsAddress && !address.trim()) next.address = "Укажите адрес доставки.";
    if (restricted && !restrictedAgreed) next.restrictedAgreed = "Подтвердите условие для агрегатов.";
    if (!count || invalidStock) next.items = "Товар недоступен или количество изменилось. Проверьте корзину.";
    setErrors(next);
    const first = (Object.keys(next) as Field[])[0];
    if (first) { focusError(first); return; }
    pendingRef.current = true;
    setPending(true);
    try {
      let key = sessionStorage.getItem("naa:checkout:key");
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem("naa:checkout:key", key); }
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, name, phone, contactMethod, deliveryMethod, address, paymentMethod, comment, agreed, restrictedAgreed, items: cart.items }) });
      const result = await response.json();
      if (!response.ok) {
        const field = (result.field ?? "submit") as Field;
        setErrors({ [field]: result.message ?? "Не удалось отправить заказ." });
        focusError(field);
        return;
      }
      sessionStorage.removeItem("naa:checkout:key");
      clearCart();
      setOrder(result as OrderResult);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors({ submit: "Связь прервалась. Повторите отправку — заказ не продублируется." });
      focusError("submit");
    } finally { pendingRef.current = false; setPending(false); }
  }

  // У кнопки: галочка для агрегатов без возврата (это условие сделки, поэтому она остаётся)
  // и строка согласия — нажимая кнопку, покупатель соглашается с условиями.
  const submitButton = <div className="grid gap-2" data-submit-block>
    {restricted ? <label className="flex items-start gap-3 text-body" data-field="restrictedAgreed"><input checked={restrictedAgreed} className="mt-0.5 shrink-0" onChange={(event) => setRestrictedAgreed(event.target.checked)} type="checkbox" />Понимаю: агрегаты возврату не подлежат, подбор подтверждает специалист</label> : null}
    {restricted ? error("restrictedAgreed") : null}
    <button className="h-control w-full rounded-ui bg-accent px-4 text-btn font-bold text-white disabled:opacity-50" disabled={pending || !settings || !catalog || !count} type="submit">{pending ? "Отправляем…" : "Подтвердить заказ"}</button>
    <p className="text-center text-meta text-ink-2" data-consent-line>Нажимая «Подтвердить заказ», вы соглашаетесь с <Link className="underline hover:text-accent" href="/returns">условиями</Link> и <Link className="underline hover:text-accent" href="/privacy">обработкой персональных данных</Link>.</p>
  </div>;

  return <main className="container-site min-h-screen bg-surface-2 py-6 pb-48 text-ink desktop:pb-8">
    <h1 className="mb-6 text-section font-bold">Оформление заказа</h1>
    {!cart.loaded || (!settings && !loadError) ? <div className="grid gap-4" aria-label="Загрузка оформления"><div className="h-32 animate-pulse rounded-ui bg-line" /><div className="h-32 animate-pulse rounded-ui bg-line" /></div> : loadError || cart.error ? <div className="rounded-ui bg-white p-6 text-body">Не удалось загрузить оформление. <button className="text-accent underline" onClick={() => window.location.reload()} type="button">Повторить</button></div> : !count ? <div className="rounded-ui bg-white p-6 text-body">В корзине пока пусто. <Link className="inline-flex min-h-11 items-center text-accent underline" href="/catalog/legkovye">Перейти в каталог</Link></div> : <form className="checkout-form grid gap-6 desktop:grid-cols-3" noValidate onSubmit={submit}>
      <div className="min-w-0 space-y-4 desktop:col-span-2">
        <section className="rounded-ui bg-white p-4 md:p-6"><h2 className="mb-4 text-block font-bold">1. Контакты</h2>
          {account
            ? <p className="mb-4 rounded-ui bg-surface-2 p-3 text-meta text-ink-2">Вы вошли как {account.name}. Имя, телефон и адрес подставлены из кабинета — поправьте, если нужно.</p>
            : <p className="mb-4 rounded-ui bg-surface-2 p-3 text-meta text-ink-2"><Link className="font-bold text-accent hover:underline" href="/login?next=/checkout">Войдите в кабинет</Link>, чтобы не вводить данные каждый раз. Можно оформить заказ и без входа.</p>}
          <div className="grid gap-4 md:grid-cols-2"><label className="block text-body" data-field="name">Имя<input autoComplete="name" className="mt-2 h-control w-full rounded-ui border border-line px-3 outline-accent" onChange={(event) => setName(event.target.value)} value={name} />{error("name")}</label><div className="text-body" data-field="phone"><span>Телефон</span><div className="mt-2"><PhoneInput onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} showError={Boolean(shownErrors.phone)} /></div>{error("phone")}</div></div>
          <fieldset className="mt-4" data-field="contactMethod"><legend className="mb-2 text-body">Как связаться</legend><div className="flex flex-wrap gap-3">{[["call", "Звонок"], ["viber", "Viber"], ["telegram", "Telegram"]].map(([id, title]) => <label className="flex items-center gap-2 text-body" key={id}><input checked={contactMethod === id} name="contact" onChange={() => setContactMethod(id)} type="radio" />{title}</label>)}</div></fieldset>
        </section>
        <section className="rounded-ui bg-white p-4 md:p-6"><h2 className="mb-4 text-block font-bold">2. Получение</h2><fieldset data-field="deliveryMethod"><legend className="sr-only">Способ получения</legend>{settings?.deliveryMethods.map((option) => <label className="mb-3 flex cursor-pointer gap-3 rounded-ui border border-line p-3" key={option.id}><input checked={deliveryMethod === option.id} name="delivery" onChange={() => setDeliveryMethod(option.id)} type="radio" /><span className="text-body"><strong className="block">{option.title}</strong><span className="text-meta text-ink-2">{option.description}</span></span></label>)}{error("deliveryMethod")}</fieldset>
          {selectedDelivery?.needsAddress ? <label className="block text-body" data-field="address">Адрес доставки<input autoComplete="street-address" className="mt-2 h-control w-full rounded-ui border border-line px-3 outline-accent" onChange={(event) => setAddress(event.target.value)} value={address} />{error("address")}</label> : null}
        </section>
        <section className="rounded-ui bg-white p-4 md:p-6"><h2 className="mb-4 text-block font-bold">3. Оплата</h2><fieldset data-field="paymentMethod"><legend className="sr-only">Способ оплаты</legend>{settings?.paymentMethods.map((option) => <label className="mb-3 flex items-center gap-3 text-body" key={option.id}><input checked={paymentMethod === option.id} name="payment" onChange={() => setPaymentMethod(option.id)} type="radio" />{option.title}</label>)}{error("paymentMethod")}</fieldset>
          <label className="mt-4 block text-body" data-field="comment">Комментарий<textarea className="mt-2 min-h-24 w-full rounded-ui border border-line p-3 outline-accent" onChange={(event) => setComment(event.target.value)} value={comment} />{error("comment")}</label>
          
          
        </section>
        <div data-field="items">{invalidStock ? <p className="text-body text-accent">Состав корзины изменился. <Link className="underline" href="/cart">Проверьте корзину</Link>.</p> : null}{error("items")}</div>
        <div data-field="submit">{error("submit")}</div>
      </div>
      <aside className="self-start rounded-ui bg-white p-4 shadow-card desktop:sticky desktop:top-6 desktop:p-6">
        <button aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 text-left text-body font-bold desktop:hidden" onClick={() => setExpanded(!expanded)} type="button">{count} {itemWord(count)} · {money(total)} <ChevronDown className={expanded ? "rotate-180" : ""} size={18} /></button>
        <div className={expanded ? "mt-4 desktop:mt-0" : "hidden desktop:block"}><h2 className="hidden text-block font-bold desktop:block">Ваш заказ</h2>{rows.map(({ item, product }) => <div className="mt-3 flex justify-between gap-3 text-body" key={item.id}><span>{product?.name ?? item.id} × {item.quantity}</span><span className="shrink-0">{money((product?.priceMdl ?? 0) * item.quantity)}</span></div>)}</div>
        <div className={`mt-4 border-t border-line pt-4 text-body ${expanded ? "block" : "hidden desktop:block"}`}><div className="flex justify-between"><span>Товары ({count})</span><span>{money(total)}</span></div><div className="mt-3 flex justify-between"><span>Доставка</span><span className="text-ink-2">Уточнит оператор</span></div><div className="mt-4 flex justify-between font-bold"><span>Итого за товары</span><span>{money(total)}</span></div></div>
        <div className="mt-4 hidden desktop:block">{submitButton}</div><p className="mt-2 hidden text-center text-meta text-ink-2 desktop:block">Оператор подтвердит наличие и доставку с {settings?.operatorHours}</p>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white p-4 pb-[env(safe-area-inset-bottom)] shadow-card desktop:hidden"><div className="mb-2 flex justify-between text-body"><span>{count} {itemWord(count)}</span><span>{money(total)}</span></div>{submitButton}</div>
    </form>}
  </main>;
}

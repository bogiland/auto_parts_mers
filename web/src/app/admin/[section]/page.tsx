import { CrmWorkspace } from "@/components/admin/crm/CrmWorkspace";
import { TelegramConnect } from "@/components/admin/TelegramConnect";
import { VacanciesAdmin } from "@/components/admin/VacanciesAdmin";
import { NewsAdmin } from "@/components/admin/NewsAdmin";
import { ReviewsAdmin } from "@/components/admin/ReviewsAdmin";
import { AdsAdmin } from "@/components/admin/AdsAdmin";
import { OwnerDashboard } from "@/components/admin/OwnerDashboard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/AdminActions";
import { AdminSessionGuard } from "@/components/admin/AdminSessionGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { sections, type Section } from "@/components/admin/admin-sections";
import { RecordList } from "@/components/admin/RecordList";
import { AddPartForm } from "@/components/admin/AddPartForm";
import { CategoryTree } from "@/components/admin/reference/CategoryTree";
import { PartTypes } from "@/components/admin/reference/PartTypes";
import { VehicleTree } from "@/components/admin/reference/VehicleTree";
import { Brands } from "@/components/admin/reference/Brands";
import { categoryTree, flatCategories, listBrands, listPartTypes, vehicleTree } from "@/lib/reference-db";
import { OrderBoard } from "@/components/admin/orders/OrderBoard";
import { ReturnsBoard } from "@/components/admin/orders/ReturnsBoard";
import { PartsBoard } from "@/components/admin/parts/PartsBoard";
import { DonorsBoard } from "@/components/admin/parts/DonorsBoard";
import { SitePages } from "@/components/admin/pages/SitePages";
import { StaffAccess } from "@/components/admin/StaffAccess";
import { listOrderRows, listReturns, orderDetail, statusLabel } from "@/lib/orders-db";
import { listDonors, listParts, locationSuggestions, partTypeUsage } from "@/lib/parts-db";
import { allPages, placements } from "@/lib/pages-db";
import { getSettings } from "@/lib/checkout-db";
import { requireStaff } from "@/lib/staff-auth";
import { listAudit, listCosts, listInquiries, listOrders, listUsers, moneySummary } from "@/lib/staff-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const amount = (value: unknown) => `${Number(value ?? 0).toLocaleString("ru-RU")} L.`;
const referenceTabs = [{ id: "categories", label: "Категории" }, { id: "types", label: "Типы деталей" }, { id: "vehicles", label: "Марки и модели" }, { id: "brands", label: "Бренды" }] as const;

export default async function Page({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ new?: string; tab?: string; add?: string; period?: string }> }) {
  const { section } = await params;
  const query = await searchParams;
  const openNew = query.new === "1";
  const tab = referenceTabs.some((item) => item.id === query.tab) ? query.tab : "categories";
  const staff = await requireStaff();
  if (!(section in sections)) notFound();
  const id = section as Section;
  if ("owner" in sections[id] && staff.role !== "owner") notFound();
  const orders = (await listOrders());
  const requests = (await listInquiries("expert"));
  const applications = (await listInquiries("catalog"));
  const counts = { orders: orders.length, requests: requests.length, applications: applications.length, new: orders.filter((row) => row.status === "received").length + requests.filter((row) => row.status === "new").length };
  const when = async (value: unknown) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: (await getSettings()).timezone }).format(new Date(String(value)));
  const settings = id === "settings" ? (await getSettings()) : null;
  const summary = staff.role === "owner" && ["dashboard", "money", "reports"].includes(id) ? (await moneySummary()) : null;
  const statusLabels = Object.fromEntries(["received", "confirmed", "ready", "shipped", "issued", "cancelled", "returned"].map((status) => [status, statusLabel(status)]));
  const withReference = ["inventory", "reference", "donors", "orders"].includes(id);
  const referenceFlat = withReference ? (await flatCategories()) : [];
  const partTypes = withReference ? (await listPartTypes()) : [];
  const referenceMakes = withReference ? (await vehicleTree()) : [];
  return <AdminShell counts={counts} name={staff.name} role={staff.role} section={id}><AdminSessionGuard />
    {id === "reports" && <CrmWorkspace mode="reports" />}
    {id === "dashboard" && (staff.role === "owner" ? <OwnerDashboard period={query.period} /> : <div className="admin-grid"><div className="admin-card admin-stat"><small>Новых заказов</small><strong>{orders.filter((row) => row.status === "received").length}</strong><Link href="/admin/orders">Открыть заказы →</Link></div><div className="admin-card admin-stat"><small>Обращений</small><strong>{requests.length}</strong><Link href="/admin/requests">Открыть обращения →</Link></div></div>)}
    {id === "tasks" && <CrmWorkspace mode="tasks" />}
    {id === "profile" && <div className="admin-card"><TelegramConnect /></div>}
    {id === "vacancies" && <VacanciesAdmin mode="jobs" />}
    {id === "news" && <NewsAdmin />}
    {id === "advertising" && <AdsAdmin />}
    {id === "reviews" && <ReviewsAdmin />}
    {id === "candidates" && <VacanciesAdmin mode="candidates" />}
    {id === "orders" && <OrderBoard deliveryMethods={(await getSettings()).deliveryMethods} openNew={openNew} paymentMethods={(await getSettings()).paymentMethods} rows={(await listOrderRows())} statusLabels={statusLabels} telegramBase={(await getSettings()).messengers.telegram} viberBase={(await getSettings()).messengers.viber} />}
    {id === "clients" && <CrmWorkspace mode="clients" />}
    {id === "returns" && <ReturnsBoard candidates={(await Promise.all((await listOrderRows()).filter((row) => ["issued", "returned"].includes(row.status)).map(async (row) => (await orderDetail(row.id))))).filter((order): order is NonNullable<typeof order> => Boolean(order)).map((order) => ({ id: order.id, number: order.number, name: order.name, status: order.status, items: order.items.map((item) => ({ productId: item.productId, name: item.name, quantity: item.quantity, unitPriceMdl: item.unitPriceMdl, returnRestricted: item.returnRestricted })) }))} rows={(await listReturns())} />}
    {(id === "requests" || id === "applications") && <CrmWorkspace mode="requests" openNew={openNew} />}
    {id === "inventory" && <><details className="admin-card" open={openNew || undefined} style={{ marginBottom: 16 }}><summary>Быстрое добавление одной формой, без фото</summary><AddPartForm categories={referenceFlat} defaultOpen={openNew} makes={referenceMakes} types={partTypes} /></details><PartsBoard categories={referenceFlat.map((node) => ({ id: node.id, nameRu: node.nameRu, depth: node.depth }))} donors={(await listDonors())} locations={(await locationSuggestions())} makes={referenceMakes} openWizard={query.add === "1"} parts={(await listParts())} typeUsage={(await partTypeUsage())} types={partTypes} /></>}
    {id === "donors" && <DonorsBoard donors={(await listDonors())} makes={referenceMakes} />}
    {id === "pages" && <SitePages pages={(await allPages())} placements={[...placements]} />}
    {id === "reference" && <><div className="admin-tabs">{referenceTabs.map((item) => <Link className={tab === item.id ? "is-active" : ""} href={`/admin/reference?tab=${item.id}`} key={item.id}>{item.label}</Link>)}</div>{tab === "categories" && <CategoryTree flat={referenceFlat} tree={(await categoryTree())} />}{tab === "types" && <PartTypes categories={referenceFlat} types={partTypes} />}{tab === "vehicles" && <VehicleTree makes={referenceMakes} />}{tab === "brands" && <Brands brands={(await listBrands())} />}</>}
    {id === "import" && <div className="admin-card"><h2>Обновление склада CSV</h2><p className="admin-muted">Одна строка на деталь: id,price,stock</p><AdminAction action="import" fields={{}} submitLabel="Импортировать"><label className="admin-field">Данные CSV<textarea name="csv" required rows={8} /></label></AdminAction></div>}
    {(id === "money" || id === "reports") && summary && <div className="admin-grid"><div className="admin-card admin-stat"><small>Заказов</small><strong>{summary.orders}</strong></div><div className="admin-card admin-stat"><small>Сумма заказов</small><strong>{amount(summary.total)}</strong></div><div className="admin-card admin-stat"><small>Валовая прибыль по известной себестоимости</small><strong>{amount(summary.gross)}</strong><p className="admin-muted">Без расходов и стоимости доставки</p></div><div className="admin-card admin-stat"><small>Без себестоимости</small><strong>{summary.missing}</strong><p className="admin-muted">Прибыль неполная</p></div></div>}
    {id === "settings" && settings && <div className="admin-card"><h2>Контакты и условия магазина</h2><p className="admin-muted">Курс рублей ПМР за 1 MDL заполните самостоятельно. Он используется для второй валюты.</p><AdminAction action="settings" fields={{}}><label className="admin-field">Телефон ПМР<input defaultValue={settings.phones.pmr} name="phonePmr" required type="tel" /></label><label className="admin-field">Телефон Молдова<input defaultValue={settings.phones.moldova} name="phoneMoldova" required type="tel" /></label><label className="admin-field">Адрес самовывоза<input defaultValue={settings.pickupAddress} name="pickupAddress" required /></label><label className="admin-field">Часы точки<input defaultValue={settings.pickupHours} name="pickupHours" required /></label><label className="admin-field">Часы оператора<input defaultValue={settings.operatorHours} name="operatorHours" required /></label><label className="admin-field">Рубли ПМР за 1 MDL<input defaultValue={settings.rubPerMdl ?? ""} min="0.001" name="rubPerMdl" placeholder="Введите курс" step="any" type="number" /></label><label className="admin-field">Ссылка Viber (необязательно)<input defaultValue={settings.messengers.viber} name="viberUrl" placeholder="viber:// или https://" /></label><label className="admin-field">Ссылка Telegram (необязательно)<input defaultValue={settings.messengers.telegram} name="telegramUrl" placeholder="https://t.me/..." /></label>{(["whatsapp","instagram","youtube","messenger"] as const).map(key=><label className="admin-field" key={key}>{key}<input type="url" defaultValue={settings.socials[key]} name={`social_${key}`} placeholder="https://" /></label>)}<label className="admin-field admin-field-wide">Шапка чека<input defaultValue={settings.receipt.header} name="receiptHeader" /></label><label className="admin-field admin-field-wide">Реквизиты в чеке<textarea defaultValue={settings.receipt.requisites} name="receiptRequisites" rows={3} /></label><label className="admin-field admin-field-wide">Подпись в чеке<input defaultValue={settings.receipt.signature} name="receiptSignature" /></label><label className="admin-field admin-field-wide">Строка «Гарантия и возврат»<textarea defaultValue={settings.receipt.warranty} name="receiptWarranty" rows={3} /></label><label className="admin-field">Название второго документа<input defaultValue={settings.receipt.invoiceTitle} name="receiptInvoiceTitle" /></label><label className="admin-field">Номер фискального чека по умолчанию<input defaultValue={settings.receipt.fiscalNumber} name="receiptFiscalNumber" placeholder="Оставьте пустым, если не нужен" /></label></AdminAction><p className="admin-note">Фискальный чек и кассовый аппарат — отдельный вопрос к бухгалтеру по правилам ПМР. Сайт выдаёт товарный чек; поле для номера фискального чека есть в заказе и здесь.</p></div>}
    {id === "users" && <div className="admin-list"><StaffAccess /><div className="admin-card"><h2>Завести сотрудника отдельным логином</h2><p className="admin-muted">Нужно, если у человека нет кабинета на сайте. Пароль — не короче 12 символов.</p><AdminAction action="add-user" fields={{}}><label className="admin-field">Имя<input name="name" required /></label><label className="admin-field">Телефон<input name="phone" required type="tel" /></label><label className="admin-field">Пароль<input minLength={12} name="password" required type="password" /></label><label className="admin-field">Роль<select name="role"><option value="operator">Operator</option><option value="owner">Owner</option></select></label></AdminAction></div>{(await listUsers()).map((row) => <div className="admin-card" key={String(row.id)}><div className="admin-row"><strong>{row.name}</strong><span>{row.phone} · {row.role === "owner" ? "владелец" : "оператор"}{row.customer_id ? ` · кабинет № ${row.customer_id}` : " · отдельный логин"}</span></div><AdminAction action="role" fields={{ id: Number(row.id) }}><label className="admin-field">Роль<select defaultValue={String(row.role)} name="role"><option value="operator">Operator</option><option value="owner">Owner</option></select></label></AdminAction><AdminAction action="delete-user" fields={{ id: Number(row.id) }} submitLabel="Удалить сотрудника">{null}</AdminAction></div>)}</div>}
    {id === "journal" && <div className="admin-list">{(await Promise.all((await listAudit()).map(async (row, index) => <div className="admin-card" key={index}><div className="admin-row"><strong>{row.actor_name} · {row.action}</strong><span className="admin-muted">{(await when(row.at))}</span></div>{row.details && <p className="admin-muted">{row.details}</p>}</div>)))}{!(await listAudit()).length && <div className="admin-card">Записей пока нет.</div>}</div>}
    {id === "costs" && <RecordList empty="Деталей пока нет" rows={(await listCosts()).map((row) => ({ key: String(row.id), title: String(row.name), meta: `Цена ${amount(row.price_mdl)}`, search: `${row.id} ${row.name}`, content: <AdminAction action="cost" fields={{ id: String(row.id) }}><label className="admin-field">Себестоимость MDL<input defaultValue={row.cost_mdl === null ? "" : Number(row.cost_mdl)} min="0" name="cost" required type="number" /></label></AdminAction> }))} />}
    {id === "export" && <div className="admin-card"><h2>Экспорт заказов</h2><p className="admin-muted">Выгрузка CSV доступна владельцу.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- это выгрузка файла, а не переход на страницу сайта */}
      <a className="admin-button" href="/api/staff/export">Скачать CSV</a>
    </div>}
  </AdminShell>;
}

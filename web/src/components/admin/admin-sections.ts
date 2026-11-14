import { Boxes, Car, ChartNoAxesCombined, ClipboardList, Contact, Download, FileText, LayoutDashboard, LayoutTemplate, Library, Package, Settings, Shield, Undo2, Users, Wallet } from "lucide-react";

export const sections = {
  dashboard: { label: "Дашборд", group: "Обзор", icon: LayoutDashboard, subtitle: "Сводка работы магазина" },
  requests: { label: "Обращения", group: "Продажи", icon: Contact, subtitle: "Запросы на подбор деталей" },
  orders: { label: "Заказы", group: "Продажи", icon: ClipboardList, subtitle: "Подтверждение и выдача заказов" },
  clients: { label: "Клиенты", group: "Продажи", icon: Users, subtitle: "Покупатели и история заказов" },
  applications: { label: "Заявки", group: "Продажи", icon: FileText, subtitle: "Заявки на детали из каталога" },
  returns: { label: "Возвраты", group: "Продажи", icon: Undo2, subtitle: "Осмотр, решение и сумма возврата" },
  inventory: { label: "Детали", group: "Склад", icon: Package, subtitle: "Цены и остатки" },
  donors: { label: "Доноры", group: "Склад", icon: Car, subtitle: "Машины, с которых снимают детали" },
  import: { label: "Импорт", group: "Склад", icon: Download, subtitle: "Обновление склада из CSV" },
  reference: { label: "Справочники", group: "Склад", icon: Library, subtitle: "Категории, типы деталей, марки и бренды", owner: true },
  money: { label: "Деньги", group: "Финансы", icon: Wallet, subtitle: "Суммы заказов и валовая прибыль", owner: true },
  reports: { label: "Отчёты", group: "Финансы", icon: ChartNoAxesCombined, subtitle: "Показатели продаж", owner: true },
  costs: { label: "Себестоимость", group: "Финансы", icon: Boxes, subtitle: "Закупочная стоимость деталей", owner: true },
  export: { label: "Экспорт", group: "Финансы", icon: Download, subtitle: "Выгрузка заказов", owner: true },
  pages: { label: "Страницы", group: "Сайт", icon: LayoutTemplate, subtitle: "Текст, фото и порядок страниц сайта", owner: true },
  users: { label: "Пользователи", group: "Команда", icon: Users, subtitle: "Доступ сотрудников", owner: true },
  settings: { label: "Настройки", group: "Система", icon: Settings, subtitle: "Контакты, часы и курс валют", owner: true },
  journal: { label: "Журнал", group: "Система", icon: Shield, subtitle: "История действий сотрудников", owner: true },
} as const;
export type Section = keyof typeof sections;

export const categoryTabs = [
  { id: "popular", label: "Популярные", icon: "Grid2X2" },
  { id: "maintenance", label: "ТО и расходники", icon: "Wrench" },
  { id: "brakes", label: "Тормозная система", icon: "Disc3" },
  { id: "suspension", label: "Подвеска", icon: "CircleDot" },
  { id: "engine", label: "Двигатель", icon: "Cog" },
  { id: "electrical", label: "Электрика", icon: "Battery" },
] as const;

export type HomeCategoryTab = (typeof categoryTabs)[number]["id"];

export type HomeCategory = {
  id: string;
  title: string;
  href: string;
  image: string | null;
  imageAlt: string;
  tab: HomeCategoryTab;
  icon: string;
};

const catalog = "/catalog/legkovye";

export const homeCategories: HomeCategory[] = [
  { id: "popular-engine", title: "Двигатель и компоненты", href: `${catalog}/dvigatel`, image: "/images/products/spark-plugs.png", imageAlt: "Свечи зажигания", tab: "popular", icon: "Cog" },
  { id: "popular-brakes", title: "Тормозная система", href: `${catalog}/tormoza`, image: "/images/products/brake-disc.png", imageAlt: "Тормозной диск", tab: "popular", icon: "Disc3" },
  { id: "popular-suspension", title: "Подвеска и рулевое управление", href: `${catalog}/podveska`, image: null, imageAlt: "", tab: "popular", icon: "CircleDot" },
  { id: "popular-transmission", title: "Трансмиссия и коробка передач", href: `${catalog}/transmissiya`, image: null, imageAlt: "", tab: "popular", icon: "Settings2" },
  { id: "popular-electrical", title: "Электрооборудование", href: `${catalog}/elektrooborudovanie`, image: "/images/products/battery.png", imageAlt: "Автомобильный аккумулятор", tab: "popular", icon: "Battery" },
  { id: "popular-cooling", title: "Охлаждение и отопление", href: `${catalog}/ohlazhdenie`, image: null, imageAlt: "", tab: "popular", icon: "Fan" },
  { id: "popular-body", title: "Кузов и экстерьер", href: `${catalog}/kuzov`, image: null, imageAlt: "", tab: "popular", icon: "CarFront" },
  { id: "popular-interior", title: "Интерьер и комфорт", href: `${catalog}/interer`, image: null, imageAlt: "", tab: "popular", icon: "Armchair" },
  { id: "popular-exhaust", title: "Выхлопная система", href: `${catalog}/vyhlop`, image: null, imageAlt: "", tab: "popular", icon: "Wind" },
  { id: "popular-filters", title: "Фильтры и расходники", href: `${catalog}/filtry`, image: null, imageAlt: "", tab: "popular", icon: "Filter" },
  { id: "popular-bearings", title: "Подшипники и крепёж", href: `${catalog}/krepezh`, image: null, imageAlt: "", tab: "popular", icon: "CircleGauge" },
  { id: "popular-accessories", title: "Аксессуары и тюнинг", href: `${catalog}/aksessuary`, image: null, imageAlt: "", tab: "popular", icon: "Sparkles" },

  { id: "maintenance-oil-filter", title: "Масляные фильтры", href: `${catalog}/filtry/maslyanye`, image: "/images/products/oil-filter.png", imageAlt: "Масляный фильтр", tab: "maintenance", icon: "Filter" },
  { id: "maintenance-air-filter", title: "Воздушные фильтры", href: `${catalog}/filtry/vozdushnye`, image: "/images/products/air-filter.png", imageAlt: "Воздушный фильтр", tab: "maintenance", icon: "Filter" },
  { id: "maintenance-spark-plugs", title: "Свечи зажигания", href: `${catalog}/dvigatel/svechi`, image: "/images/products/spark-plugs.png", imageAlt: "Свечи зажигания", tab: "maintenance", icon: "Sparkles" },
  { id: "maintenance-fluids", title: "Технические жидкости", href: `${catalog}/zhidkosti`, image: null, imageAlt: "", tab: "maintenance", icon: "Fuel" },
  { id: "maintenance-belts", title: "Ремни и ролики", href: `${catalog}/dvigatel/remni`, image: null, imageAlt: "", tab: "maintenance", icon: "Cable" },
  { id: "maintenance-wipers", title: "Щётки стеклоочистителя", href: `${catalog}/aksessuary/shchetki`, image: null, imageAlt: "", tab: "maintenance", icon: "Wind" },
  { id: "maintenance-cabin-filter", title: "Салонные фильтры", href: `${catalog}/filtry/salonnye`, image: null, imageAlt: "", tab: "maintenance", icon: "Filter" },
  { id: "maintenance-pads", title: "Тормозные колодки", href: `${catalog}/tormoza/kolodki`, image: null, imageAlt: "", tab: "maintenance", icon: "Disc3" },
  { id: "maintenance-disc", title: "Тормозные диски", href: `${catalog}/tormoza/diski`, image: null, imageAlt: "", tab: "maintenance", icon: "Disc3" },
  { id: "maintenance-battery", title: "Аккумуляторы", href: `${catalog}/elektrooborudovanie/akkumulyatory`, image: null, imageAlt: "", tab: "maintenance", icon: "Battery" },
  { id: "maintenance-lamps", title: "Автолампы", href: `${catalog}/elektrooborudovanie/lampy`, image: null, imageAlt: "", tab: "maintenance", icon: "Lightbulb" },
  { id: "maintenance-fasteners", title: "Крепёж и клипсы", href: `${catalog}/krepezh`, image: null, imageAlt: "", tab: "maintenance", icon: "Bolt" },

  { id: "brakes-discs", title: "Тормозные диски", href: `${catalog}/tormoza/diski`, image: "/images/products/brake-disc.png", imageAlt: "Тормозной диск", tab: "brakes", icon: "Disc3" },
  { id: "brakes-pads", title: "Тормозные колодки", href: `${catalog}/tormoza/kolodki`, image: "/images/products/brake-pads.png", imageAlt: "Тормозные колодки", tab: "brakes", icon: "Disc3" },
  { id: "brakes-calipers", title: "Тормозные суппорты", href: `${catalog}/tormoza/supporty`, image: null, imageAlt: "", tab: "brakes", icon: "CircleDot" },
  { id: "brakes-hoses", title: "Тормозные шланги", href: `${catalog}/tormoza/shlangi`, image: null, imageAlt: "", tab: "brakes", icon: "Cable" },
  { id: "brakes-fluid", title: "Тормозная жидкость", href: `${catalog}/tormoza/zhidkost`, image: null, imageAlt: "", tab: "brakes", icon: "Fuel" },
  { id: "brakes-sensors", title: "Датчики ABS", href: `${catalog}/tormoza/datchiki-abs`, image: null, imageAlt: "", tab: "brakes", icon: "Gauge" },
  { id: "brakes-parking", title: "Стояночный тормоз", href: `${catalog}/tormoza/ruchnoy`, image: null, imageAlt: "", tab: "brakes", icon: "CircleGauge" },
  { id: "brakes-master", title: "Главный тормозной цилиндр", href: `${catalog}/tormoza/cilindr`, image: null, imageAlt: "", tab: "brakes", icon: "Settings2" },
  { id: "brakes-booster", title: "Вакуумный усилитель", href: `${catalog}/tormoza/usilitel`, image: null, imageAlt: "", tab: "brakes", icon: "CircleDot" },
  { id: "brakes-shields", title: "Защитные щиты", href: `${catalog}/tormoza/shchity`, image: null, imageAlt: "", tab: "brakes", icon: "ShieldCheck" },
  { id: "brakes-kits", title: "Ремкомплекты тормозов", href: `${catalog}/tormoza/remkomplekty`, image: null, imageAlt: "", tab: "brakes", icon: "Wrench" },
  { id: "brakes-hardware", title: "Крепёж колодок", href: `${catalog}/tormoza/krepezh`, image: null, imageAlt: "", tab: "brakes", icon: "Bolt" },

  { id: "suspension-shocks", title: "Амортизаторы", href: `${catalog}/podveska/amortizatory`, image: null, imageAlt: "", tab: "suspension", icon: "CircleDot" },
  { id: "suspension-springs", title: "Пружины подвески", href: `${catalog}/podveska/pruzhiny`, image: null, imageAlt: "", tab: "suspension", icon: "Waves" },
  { id: "suspension-arms", title: "Рычаги подвески", href: `${catalog}/podveska/rychagi`, image: null, imageAlt: "", tab: "suspension", icon: "GitBranch" },
  { id: "suspension-bushings", title: "Сайлентблоки", href: `${catalog}/podveska/saylentbloki`, image: null, imageAlt: "", tab: "suspension", icon: "CircleDot" },
  { id: "suspension-bearings", title: "Ступичные подшипники", href: `${catalog}/podveska/podshipniki`, image: null, imageAlt: "", tab: "suspension", icon: "CircleGauge" },
  { id: "suspension-stabilizer", title: "Стойки стабилизатора", href: `${catalog}/podveska/stabilizator`, image: null, imageAlt: "", tab: "suspension", icon: "MoveVertical" },
  { id: "suspension-steering", title: "Рулевые рейки", href: `${catalog}/rulevoe/reiki`, image: null, imageAlt: "", tab: "suspension", icon: "CircleDot" },
  { id: "suspension-tips", title: "Рулевые наконечники", href: `${catalog}/rulevoe/nakonechniki`, image: null, imageAlt: "", tab: "suspension", icon: "ArrowRightLeft" },
  { id: "suspension-joints", title: "Шаровые опоры", href: `${catalog}/podveska/sharovye`, image: null, imageAlt: "", tab: "suspension", icon: "CircleDot" },
  { id: "suspension-cv", title: "ШРУСы и пыльники", href: `${catalog}/podveska/shrusy`, image: null, imageAlt: "", tab: "suspension", icon: "Settings2" },
  { id: "suspension-crossmember", title: "Подрамники", href: `${catalog}/podveska/podramniki`, image: null, imageAlt: "", tab: "suspension", icon: "Frame" },
  { id: "suspension-mounts", title: "Опоры стоек", href: `${catalog}/podveska/opory`, image: null, imageAlt: "", tab: "suspension", icon: "CircleDot" },

  { id: "engine-spark", title: "Свечи зажигания", href: `${catalog}/dvigatel/svechi`, image: "/images/products/spark-plugs.png", imageAlt: "Свечи зажигания", tab: "engine", icon: "Sparkles" },
  { id: "engine-belts", title: "Ремни и ролики", href: `${catalog}/dvigatel/remni`, image: null, imageAlt: "", tab: "engine", icon: "Cable" },
  { id: "engine-gaskets", title: "Прокладки двигателя", href: `${catalog}/dvigatel/prokladki`, image: null, imageAlt: "", tab: "engine", icon: "Layers" },
  { id: "engine-pistons", title: "Поршни и кольца", href: `${catalog}/dvigatel/porshni`, image: null, imageAlt: "", tab: "engine", icon: "CircleDot" },
  { id: "engine-valves", title: "Клапаны и ГБЦ", href: `${catalog}/dvigatel/klapany`, image: null, imageAlt: "", tab: "engine", icon: "Settings2" },
  { id: "engine-turbo", title: "Турбокомпрессоры", href: `${catalog}/dvigatel/turbiny`, image: null, imageAlt: "", tab: "engine", icon: "Fan" },
  { id: "engine-sensors", title: "Датчики двигателя", href: `${catalog}/dvigatel/datchiki`, image: null, imageAlt: "", tab: "engine", icon: "Gauge" },
  { id: "engine-injection", title: "Топливная система", href: `${catalog}/dvigatel/toplivo`, image: null, imageAlt: "", tab: "engine", icon: "Fuel" },
  { id: "engine-cooling", title: "Система охлаждения", href: `${catalog}/ohlazhdenie`, image: null, imageAlt: "", tab: "engine", icon: "Fan" },
  { id: "engine-mounts", title: "Опоры двигателя", href: `${catalog}/dvigatel/opory`, image: null, imageAlt: "", tab: "engine", icon: "Wrench" },
  { id: "engine-crank", title: "Коленвал и вкладыши", href: `${catalog}/dvigatel/kolenval`, image: null, imageAlt: "", tab: "engine", icon: "RotateCw" },
  { id: "engine-timing", title: "Цепь ГРМ", href: `${catalog}/dvigatel/grm`, image: null, imageAlt: "", tab: "engine", icon: "Link" },

  { id: "electrical-battery", title: "Аккумуляторы", href: `${catalog}/elektrooborudovanie/akkumulyatory`, image: "/images/products/battery.png", imageAlt: "Автомобильный аккумулятор", tab: "electrical", icon: "Battery" },
  { id: "electrical-lamps", title: "Автолампы", href: `${catalog}/elektrooborudovanie/lampy`, image: null, imageAlt: "", tab: "electrical", icon: "Lightbulb" },
  { id: "electrical-alternator", title: "Генераторы", href: `${catalog}/elektrooborudovanie/generatory`, image: null, imageAlt: "", tab: "electrical", icon: "Zap" },
  { id: "electrical-starter", title: "Стартеры", href: `${catalog}/elektrooborudovanie/startery`, image: null, imageAlt: "", tab: "electrical", icon: "Power" },
  { id: "electrical-sensors", title: "Датчики", href: `${catalog}/elektrooborudovanie/datchiki`, image: null, imageAlt: "", tab: "electrical", icon: "Gauge" },
  { id: "electrical-wiring", title: "Проводка", href: `${catalog}/elektrooborudovanie/provodka`, image: null, imageAlt: "", tab: "electrical", icon: "Cable" },
  { id: "electrical-fuses", title: "Предохранители", href: `${catalog}/elektrooborudovanie/predohraniteli`, image: null, imageAlt: "", tab: "electrical", icon: "ShieldCheck" },
  { id: "electrical-control", title: "Блоки управления", href: `${catalog}/elektrooborudovanie/bloki`, image: null, imageAlt: "", tab: "electrical", icon: "Cpu" },
  { id: "electrical-relays", title: "Реле", href: `${catalog}/elektrooborudovanie/rele`, image: null, imageAlt: "", tab: "electrical", icon: "CircuitBoard" },
  { id: "electrical-switches", title: "Выключатели", href: `${catalog}/elektrooborudovanie/vyklyuchateli`, image: null, imageAlt: "", tab: "electrical", icon: "ToggleLeft" },
  { id: "electrical-cameras", title: "Камеры и парктроники", href: `${catalog}/elektrooborudovanie/parktroniki`, image: null, imageAlt: "", tab: "electrical", icon: "Camera" },
  { id: "electrical-horns", title: "Звуковые сигналы", href: `${catalog}/elektrooborudovanie/signaly`, image: null, imageAlt: "", tab: "electrical", icon: "Volume2" },
];

import type { Category } from "@/domain/catalog";

export interface DirectionHomeDefinition {
  slug: "legkovye" | "avtohimiya" | "gruzovye";
  name: string;
  pageTitle: string;
  description: string;
  selectionTitle: string;
  selectionHint: string;
  brands: string[];
  categoryIds: string[];
  productOffset: number;
}

export const directionHomes: DirectionHomeDefinition[] = [
  {
    slug: "legkovye",
    name: "Легковые запчасти",
    pageTitle: "Запчасти для легковых автомобилей",
    description: "Запчасти для легковых автомобилей: подбор по марке, модели и артикулу.",
    selectionTitle: "Подберём запчасть для легкового авто",
    selectionHint: "Укажите марку, модель или артикул детали.",
    brands: ["Audi", "BMW", "Chevrolet", "Citroën", "Ford", "Honda", "Hyundai", "Kia", "Mazda", "Mercedes-Benz", "Mitsubishi", "Nissan", "Opel", "Renault", "Skoda", "Toyota", "Volkswagen", "Volvo"],
    categoryIds: ["category-engine", "category-brakes", "category-suspension", "category-transmission", "category-electrical", "category-cooling", "category-body", "category-interior", "category-exhaust"],
    productOffset: 0,
  },
  {
    slug: "avtohimiya",
    name: "Автохимия и масла",
    pageTitle: "Автохимия и масла",
    description: "Масла, технические жидкости и уход за автомобилем с подбором по допуску.",
    selectionTitle: "Подберём масло или автохимию",
    selectionHint: "Укажите марку, модель, двигатель или нужный допуск.",
    brands: ["Addinol", "Areol", "Bardahl", "Castrol", "Comma", "Febi", "Liqui Moly", "Mannol", "Motul", "Ravenol", "Sintec", "Total", "Valvoline", "Wolf", "ZIC"],
    categoryIds: ["category-transmission", "category-filters", "category-cooling", "category-interior", "category-electrical", "category-exhaust"],
    productOffset: 1,
  },
  {
    slug: "gruzovye",
    name: "Грузовые запчасти",
    pageTitle: "Запчасти для грузовых автомобилей",
    description: "Расходники и детали для грузовой техники с подбором по VIN и модели.",
    selectionTitle: "Подберём запчасть для грузового авто",
    selectionHint: "Укажите VIN, марку грузовика или номер детали.",
    brands: ["DAF", "Iveco", "MAN", "Mercedes-Benz Trucks", "Renault Trucks", "Scania", "Volvo Trucks", "КамАЗ", "МАЗ"],
    categoryIds: ["category-engine", "category-brakes", "category-suspension", "category-transmission", "category-bearings", "category-filters"],
    productOffset: 3,
  },
];

const categoryPathSlugs: Record<string, string> = {
  engine: "dvigatel",
  brakes: "tormoza",
  suspension: "podveska",
  transmission: "transmissiya",
  electrical: "elektrooborudovanie",
  cooling: "ohlazhdenie",
  body: "kuzov",
  interior: "interer",
  exhaust: "vyhlop",
  filters: "filtry",
  bearings: "podshipniki",
  accessories: "aksessuary",
};

export function categoryPathSlug(categorySlug: string) {
  return categoryPathSlugs[categorySlug] ?? categorySlug;
}

export function sourceCategorySlug(categoryPathSlugValue: string) {
  return Object.entries(categoryPathSlugs).find(([, publicSlug]) => publicSlug === categoryPathSlugValue)?.[0] ?? categoryPathSlugValue;
}

export function getDirectionHome(slug: string) {
  return directionHomes.find((direction) => direction.slug === slug);
}

export function categoriesForDirection(categories: Category[], direction: DirectionHomeDefinition) {
  return direction.categoryIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => Boolean(category));
}

import { ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { CategoryIcon, MercedesIcon } from "@/components/catalog/category-icon";
import { categoryPathSlug } from "@/data/directions.seed";
import type { Category } from "@/domain/catalog";

export function CategorySidebar({ categories }: { categories: Category[] }) {
  return (
    <aside className="category-sidebar" aria-label="Категории каталога">
      <div className="category-sidebar__title"><LayoutGrid size={19} strokeWidth={1.8} /><span>Все категории</span></div>
      <ul>{categories.map((category) => <li key={category.id}><Link href={`/catalog/legkovye/${categoryPathSlug(category.slug)}`}><CategoryIcon slug={category.slug} size={20} /><span>{category.name}</span><ChevronRight size={17} strokeWidth={1.7} /></Link></li>)}</ul>
      <Link className="category-sidebar__original" href="/catalog/legkovye"><MercedesIcon /><span>Оригинальные детали Mercedes-Benz</span><ChevronRight size={17} strokeWidth={1.7} /></Link>
    </aside>
  );
}

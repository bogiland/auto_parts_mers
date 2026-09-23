import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import type { Category } from "@/domain/catalog";

export function CategoryCard({ category }: { category: Category }) {
  return <a className="category-card" href={`/catalog/${category.slug}`}><div className="category-card__visual"><Image alt={category.image.alt} fill sizes="(max-width: 850px) 50vw, 20vw" src={category.image.url} /></div><div className="category-card__footer"><div><h3>{category.name}</h3><p>{category.productCount.toLocaleString("ru-RU")} товаров</p></div><ArrowUpRight size={18} strokeWidth={1.7} /></div></a>;
}

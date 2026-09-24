import Image from "next/image";
import Link from "next/link";

import type { Category } from "@/domain/catalog";

export function CategoryCard({ basePath = "/catalog/legkovye", category, pathSlug = category.slug }: { basePath?: string; category: Category; pathSlug?: string }) {
  return <Link className="category-card" href={`${basePath}/${pathSlug}`}><div className="category-card__visual"><Image alt={category.image.alt} fill sizes="(max-width: 599px) 30vw, (max-width: 1023px) 23vw, 15vw" src={category.image.url} /></div><div className="category-card__footer"><h3>{category.name}</h3></div></Link>;
}

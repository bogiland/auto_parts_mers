import Image from "next/image";
import Link from "next/link";

import type { Category } from "@/domain/catalog";

export function CategoryCard({ basePath = "/catalog/legkovye", category, pathSlug = category.slug }: { basePath?: string; category: Category; pathSlug?: string }) {
  const fallback: Record<string, string> = { "demo-brakes": "categories/brakes.png", "demo-engine": "categories/engine.png", "demo-body": "categories/body.png", "demo-optics": "categories/body.png", "demo-filters": "categories/filters.png", "demo-oils": "posts/oil-change.png", "demo-pads": "products/brake-pads.png", "demo-pads-front": "products/brake-pads.png" };
  const image = category.image.url.trim() || `/images/${fallback[category.slug] ?? "products/neutral-placeholder.png"}`;
  return <Link className="category-card" href={`${basePath}/${pathSlug}`}><div className="category-card__visual"><Image alt={category.image.alt} fill sizes="(max-width: 599px) 30vw, (max-width: 1023px) 23vw, 15vw" src={image} /></div><div className="category-card__footer"><h3>{category.name}</h3></div></Link>;
}

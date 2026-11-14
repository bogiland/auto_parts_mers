import type { MetadataRoute } from "next";

import { directionHomes } from "@/data/directions.seed";
import { publicCategories } from "@/lib/reference-db";
import { publicDonors, publicParts } from "@/lib/parts-db";
import { visiblePages } from "@/lib/pages-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Адрес сайта берётся из окружения: на боевом домене задайте NEXT_PUBLIC_SITE_URL.
const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://naa.md").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }];
  for (const direction of directionHomes) entries.push({ url: `${base}/catalog/${direction.slug}`, changeFrequency: "daily", priority: 0.8 });
  // Выключенная страница и скрытая категория сюда не попадают: visiblePages и publicCategories их не возвращают.
  for (const page of visiblePages()) entries.push({ url: `${base}/${page.slug}`, changeFrequency: "monthly", priority: 0.5 });
  for (const category of publicCategories()) {
    entries.push({ url: `${base}/catalog/legkovye/${category.slug}`, changeFrequency: "daily", priority: 0.7 });
    for (const child of category.children) entries.push({ url: `${base}/catalog/legkovye/${child.slug}`, changeFrequency: "daily", priority: 0.6 });
  }
  for (const donor of publicDonors()) entries.push({ url: `${base}/donors/${donor.id}`, changeFrequency: "weekly", priority: 0.5 });
  for (const part of publicParts()) entries.push({ url: `${base}/products/${part.id}`, changeFrequency: "weekly", priority: 0.6 });
  return entries;
}

import type { MetadataRoute } from "next";

import { categoryBasePath, directionHomes } from "@/data/directions.seed";
import { showroomVehicles } from "@/lib/vehicles-db";
import { publicCategories } from "@/lib/reference-db";
import { publicDonors, publicParts } from "@/lib/parts-db";
import { visiblePages } from "@/lib/pages-db";
import { articles } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Адрес сайта берётся из окружения: на боевом домене задайте NEXT_PUBLIC_SITE_URL.
const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://naa.md").replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }];
  for (const direction of directionHomes) entries.push({ url: `${base}/catalog/${direction.slug}`, changeFrequency: "daily", priority: 0.8 });
  // Выключенная страница и скрытая категория сюда не попадают: visiblePages и publicCategories их не возвращают.
  for (const page of (await visiblePages())) entries.push({ url: `${base}/${page.slug}`, changeFrequency: "monthly", priority: 0.5 });
  entries.push({url:`${base}/news`,changeFrequency:"weekly",priority:0.5});
  entries.push({url:`${base}/advertising`,changeFrequency:"monthly",priority:0.4});
  for(const item of await articles())entries.push({url:`${base}/news/${item.slug}`,lastModified:new Date(item.published_at),changeFrequency:"monthly",priority:0.5});
  for (const category of (await publicCategories())) {
    // Раздел-направление (например, Автохимия) живёт по своему адресу, а не внутри легковых.
    const home = categoryBasePath(category.slug);
    if (!directionHomes.some((direction) => direction.slug === category.slug)) entries.push({ url: `${base}/catalog/legkovye/${category.slug}`, changeFrequency: "daily", priority: 0.7 });
    for (const child of category.children) entries.push({ url: `${base}${home}/${child.slug}`, changeFrequency: "daily", priority: 0.6 });
  }
  // Марки и модели — только те, у которых есть детали: пустые страницы в индекс не попадают.
  for (const make of (await showroomVehicles())) {
    entries.push({ url: `${base}/catalog/legkovye/${make.slug}`, changeFrequency: "weekly", priority: 0.6 });
    for (const model of make.models) entries.push({ url: `${base}/catalog/legkovye/${make.slug}/${model.slug}`, changeFrequency: "weekly", priority: 0.5 });
  }
  for (const donor of (await publicDonors())) entries.push({ url: `${base}/donors/${donor.id}`, changeFrequency: "weekly", priority: 0.5 });
  for (const part of (await publicParts())) entries.push({ url: `${base}/products/${part.id}`, changeFrequency: "weekly", priority: 0.6 });
  return entries;
}

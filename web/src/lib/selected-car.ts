import "server-only";

import { cookies } from "next/headers";

import { one, many } from "@/lib/db";
import { showroomVehicles } from "@/lib/vehicles-db";
import type { SearchParamsRecord } from "@/lib/catalog-listing";
import { carCookie, type SelectedCar } from "@/lib/selected-car-shared";

export type { SelectedCar } from "@/lib/selected-car-shared";

/**
 * Машина, которую выбрал покупатель.
 *
 * Живёт в двух местах: в адресе (`?car=mercedes-benz/e-klass/w212`) — чтобы ссылкой
 * можно было поделиться — и в куке, чтобы машина не терялась при переходе
 * с главной в поиск, в категорию и в карточку. Адрес главнее куки;
 * пустой `?car=` — явный сброс.
 *
 * Значение из куки и адреса не доверенное: оно сверяется со справочником витрины,
 * и всё, чего там нет, просто игнорируется.
 */
export async function resolveCar(slug: string): Promise<SelectedCar | null> {
  const [makeSlug, modelSlug, generationSlug] = slug.split("/").filter(Boolean);
  if (!makeSlug || !modelSlug) return null;
  const make = (await showroomVehicles()).find((item) => item.slug === makeSlug);
  const model = make?.models.find((item) => item.slug === modelSlug);
  if (!make || !model) return null;
  const generation = generationSlug ? model.generations.find((item) => item.slug === generationSlug) : model.generations.length === 1 ? model.generations[0] : undefined;
  if (generationSlug && !generation) return null;
  const donorIds = generation ? generation.donorIds : model.generations.flatMap((item) => item.donorIds);
  // Год берётся у доноров: это год той машины, что стоит на площадке, а не модельного ряда.
  const years = (await many<{ year: number | null }>("SELECT DISTINCT year FROM donors WHERE id = ANY($1::text[]) AND year IS NOT NULL ORDER BY year", [donorIds]))
    .map((row) => Number(row.year));
  const year = years.length === 0 ? "" : years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`;
  const label = [make.name, model.name, generation && generation.name !== model.name ? generation.name : ""].filter(Boolean).join(" ");
  return {
    slug: [make.slug, model.slug, generation?.slug].filter(Boolean).join("/"),
    label,
    short: [generation && generation.name !== model.name ? generation.name : `${make.name} ${model.name}`, year].filter(Boolean).join(" "),
    year,
    donorIds,
  };
}

/** Выбранная машина для страницы: сначала адрес, потом кука. */
export async function selectedCar(params?: SearchParamsRecord): Promise<{ car: SelectedCar | null; explicit: boolean }> {
  const fromUrl = params?.car;
  if (fromUrl !== undefined) {
    const value = Array.isArray(fromUrl) ? fromUrl[0] ?? "" : fromUrl;
    return { car: value ? await resolveCar(value) : null, explicit: true };
  }
  const stored = (await cookies()).get(carCookie)?.value;
  if (!stored) return { car: null, explicit: false };
  try {
    const slug = String((JSON.parse(decodeURIComponent(stored)) as { slug?: unknown }).slug ?? "");
    return { car: await resolveCar(slug), explicit: false };
  } catch {
    return { car: null, explicit: false };
  }
}

/** Подходит ли деталь к машине: только если снята с такого же донора. Остальное сверяет оператор. */
export async function partFitsCar(productId: string, car: SelectedCar | null) {
  if (!car) return null;
  const row = await one<{ donor_id: string | null }>("SELECT donor_id FROM catalog_products WHERE id = $1", [productId]);
  return row?.donor_id ? car.donorIds.includes(row.donor_id) : null;
}

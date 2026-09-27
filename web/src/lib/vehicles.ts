import brands from "@/data/vehicles/brands.json";

export type Modification = { slug: string; name: string; engine: string; fuel: "бензин" | "дизель" | "гибрид" | "электро"; volume: number; hp: number; kw: number; cylinders?: number; drive: "передний" | "задний" | "полный"; body: string; yearFrom: number; yearTo: number | null };
export type Generation = { slug: string; name: string; code: string; yearFrom: number; yearTo: number | null; image?: string; modifications: Modification[] };
export type VehicleModel = { slug: string; name: string; generations: Generation[] };
export type VehicleBrand = { slug: string; name: string };
type VehicleFile = { models: VehicleModel[] };

export function getBrands() { return brands as VehicleBrand[]; }

export async function getBrandVehicles(brand: string): Promise<VehicleFile | null> {
  if (brand === "mercedes-benz") return (await import("@/data/vehicles/mercedes-benz.json")).default as VehicleFile;
  return null;
}

export async function getModels(brand: string) { return (await getBrandVehicles(brand))?.models ?? []; }
export async function getGenerations(brand: string, model: string) { return (await getModels(brand)).find((item) => item.slug === model)?.generations ?? []; }
export async function getYears(brand: string, model: string) {
  const years = new Set<number>();
  for (const generation of await getGenerations(brand, model)) for (let year = generation.yearTo ?? new Date().getFullYear(); year >= generation.yearFrom; year -= 1) years.add(year);
  return [...years].sort((a, b) => b - a);
}
export async function getModifications(brand: string, model: string, generation: string) { return (await getGenerations(brand, model)).find((item) => item.slug === generation)?.modifications ?? []; }

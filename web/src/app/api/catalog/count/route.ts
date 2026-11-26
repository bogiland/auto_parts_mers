import { createCatalogListing, type SearchParamsRecord } from "@/lib/catalog-listing";
import { clientIp } from "@/lib/http";
import { getLiveHomepage } from "@/lib/live-catalog";
import { allow, tooMany, windows } from "@/lib/rate-limit";
import { selectedCar } from "@/lib/selected-car";

export const runtime = "nodejs";

/**
 * Сколько деталей покажет фильтр — для кнопки «Показать N».
 * Считает той же функцией, что и сама выдача, поэтому число на кнопке
 * совпадает с числом карточек после нажатия.
 */
export async function GET(request: Request) {
  if (!(await allow("catalog-count:ip", clientIp(request), windows.catalogCountIp))) return tooMany();
  const url = new URL(request.url);
  const params: SearchParamsRecord = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }
  const scope = String(url.searchParams.get("scope") ?? "all");
  const ownCategoryId = scope.startsWith("own:") ? scope.slice(4) : undefined;
  const categorySlug = scope.startsWith("slug:") ? scope.slice(5) : undefined;
  const [homepage, { car }] = await Promise.all([getLiveHomepage(), selectedCar(params)]);
  const listing = createCatalogListing(homepage, params, categorySlug, ownCategoryId, car?.donorIds);
  return Response.json({ total: listing.total }, { headers: { "Cache-Control": "no-store" } });
}

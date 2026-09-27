import { NextResponse } from "next/server";

import { getSuggestions } from "@/lib/search/catalog-search";
import { normalizeQuery } from "@/lib/search/query";

const requests = new Map<string, { count: number; startedAt: number }>();
const rateWindowMs = 1000;
const rateLimit = 20;

function isRateLimited(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = requests.get(address);

  if (!current || now - current.startedAt > rateWindowMs) {
    requests.set(address, { count: 1, startedAt: now });
    return false;
  }

  current.count += 1;
  return current.count > rateLimit;
}

export async function GET(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const query = normalizeQuery(new URL(request.url).searchParams.get("q") ?? "");
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

  if (query.length < 2) {
    return NextResponse.json({ brands: [], categories: [], products: [] }, { headers });
  }

  return NextResponse.json(await getSuggestions(query), { headers });
}

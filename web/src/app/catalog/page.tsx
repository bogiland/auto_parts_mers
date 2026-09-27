import { redirect } from "next/navigation";

export default async function CatalogIndexPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/search?q=${encodeURIComponent(q)}&from_global=true` : "/catalog/legkovye");
}

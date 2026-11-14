import type { ReactNode } from "react";

import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const homepage = await getLiveHomepage();
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    {children}
    <SiteFooter />
  </>;
}

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerLoginForm } from "@/components/account/AuthForms";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { currentCustomer } from "@/lib/customer-auth";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Вход в личный кабинет — NAA.md", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await currentCustomer()) redirect("/account");
  const homepage = await getLiveHomepage({ includeInventory: false });
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <main className="container-site section-stack">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-ui bg-white shadow-card" />}><CustomerLoginForm /></Suspense>
      </div>
    </main>
    <SiteFooter />
  </>;
}

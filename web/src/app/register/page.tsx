import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerRegisterForm } from "@/components/account/AuthForms";
import { SiteHeader } from "@/components/header/SiteHeader";
import { SiteFooter } from "@/components/layout/site-footer";
import { currentCustomer } from "@/lib/customer-auth";
import { getLiveHomepage } from "@/lib/live-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Регистрация — NAA.md", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  if (await currentCustomer()) redirect("/account");
  const homepage = await getLiveHomepage({ includeInventory: false });
  return <>
    <SiteHeader hours={homepage.hours} phone={homepage.phone} />
    <main className="container-site section-stack">
      <div className="mx-auto w-full max-w-2xl">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-ui bg-white shadow-card" />}><CustomerRegisterForm /></Suspense>
      </div>
    </main>
    <SiteFooter />
  </>;
}

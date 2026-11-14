import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { currentStaff } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Вход сотрудников — NAA.md", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page() {
  if (await currentStaff()) redirect("/admin/dashboard");
  return <main className="flex min-h-screen items-center justify-center bg-header-dark p-6 text-white"><LoginForm /></main>;
}

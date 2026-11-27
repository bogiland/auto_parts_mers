import type { Metadata } from "next";
import { roboto } from "./fonts";
import "./globals.css";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/layout/NavigationProgress";

export const metadata: Metadata = {
  title: "NAA.md — автозапчасти с разборки в Слободзее",
  description: "Б/у запчасти с разборки и новые расходники — Mercedes-Benz, Lexus, BMW, Toyota, Ford, Chevrolet. Слободзея, ПМР и Молдова.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru" className={roboto.variable}><body className="min-h-full pb-tabbar desktop:pb-0"><Suspense fallback={null}><NavigationProgress /></Suspense>{children}</body></html>;
}

import type { Metadata } from "next";
import { roboto } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAA.md — запчасти для Mercedes-Benz в Слободзее",
  description: "Каталог автозапчастей Mercedes-Benz, VIN-подбор и консультация в Слободзее.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru" className={roboto.variable}><body className="min-h-full pb-tabbar xl:pb-0">{children}</body></html>;
}

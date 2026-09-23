import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAA.md — запчасти для Mercedes-Benz в Слободзее",
  description: "Каталог автозапчастей Mercedes-Benz, VIN-подбор и консультация в Слободзее.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body className="min-h-full flex flex-col">{children}</body></html>;
}

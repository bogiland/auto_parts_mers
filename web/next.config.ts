import type { NextConfig } from "next";

// Чек и кабинет содержат персональные данные: их нельзя класть в общий кэш,
// а адрес с токеном не должен утекать в Referer при переходе по ссылке со страницы.
const privatePaths = ["/receipt/:token*", "/account/:path*", "/order/s/:token*", "/ad-report/:token*"];

const nextConfig: NextConfig = {
  async headers() {
    return privatePaths.map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
  },
};

export default nextConfig;

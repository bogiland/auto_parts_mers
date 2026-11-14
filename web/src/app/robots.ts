import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://naa.md").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      // Закрыто то, что не должно попадать в поиск: админка, служебные запросы,
      // личные ссылки на статус заказа и чеки.
      disallow: ["/admin", "/api", "/cart", "/checkout", "/favorites", "/order/", "/receipt/"],
    }],
    sitemap: `${base}/sitemap.xml`,
  };
}

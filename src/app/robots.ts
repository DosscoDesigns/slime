import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Served at /robots.txt. /api/* and /success are blocked from crawling —
 * neither is useful in an index and /success can carry a PaymentIntent id in
 * the query string.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/success"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

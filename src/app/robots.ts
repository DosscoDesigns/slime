import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Served at /robots.txt. /api/*, /success and /admin are blocked from crawling.
 * None is useful in an index; /success can carry a PaymentIntent id in the
 * query string, and /admin exposes customer names, addresses and emails and can
 * spend money buying postage. /admin is also noindex via its layout and is
 * deliberately absent from sitemap.ts — robots alone is a request, not a
 * control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/success", "/admin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

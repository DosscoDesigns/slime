import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Served at /sitemap.xml. The storefront is a single indexable page today.
 * /success and /admin are intentionally excluded — both are noindex, one is
 * only reachable after a payment and the other is behind a login. Add entries
 * here when per-kit pages land.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}

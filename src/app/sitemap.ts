import type { MetadataRoute } from "next";
import { KIT_TIERS } from "@/lib/products";
import { SITE_URL } from "@/lib/site";

/**
 * Served at /sitemap.xml.
 *
 * Built from a registry rather than a hand-written list, and the kit entries
 * are derived from KIT_TIERS — adding a fourth kit gets it into the sitemap
 * automatically instead of relying on someone remembering.
 *
 * Deliberately EXCLUDED, each for its own reason:
 *   /success   — noindex; only reachable after a payment, and carries a
 *                PaymentIntent id in the query string.
 *   /admin/*   — noindex, behind a login, and shows customer PII.
 *   /feed/*    — a Merchant Center data feed, not a page for humans.
 *
 * `priority` is a hint Google largely ignores between sites but does use to
 * rank importance WITHIN one. The ordering here is deliberate: the storefront,
 * then the things that can be bought, then the content that feeds them, then
 * the policies that nobody searches for but every store needs.
 */

type Entry = { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" };

const CONTENT: Entry[] = [
  { path: "/slime-the-teacher-fundraiser", priority: 0.8, changeFrequency: "monthly" },
  { path: "/church-slime-fundraiser", priority: 0.8, changeFrequency: "monthly" },
  { path: "/youth-group-slime-event", priority: 0.8, changeFrequency: "monthly" },
  { path: "/color-run-slime", priority: 0.8, changeFrequency: "monthly" },
  { path: "/how-to-make-slime-from-powder", priority: 0.8, changeFrequency: "monthly" },
];

const SUPPORT: Entry[] = [
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/shipping-returns", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entries: Entry[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    ...KIT_TIERS.map((tier) => ({
      path: `/kits/${tier.slug}`,
      priority: 0.9,
      changeFrequency: "weekly" as const,
    })),
    ...CONTENT,
    ...SUPPORT,
  ];

  return entries.map((e) => ({
    url: `${SITE_URL}${e.path === "/" ? "/" : e.path}`,
    lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}

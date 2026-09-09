import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { KIT_TIERS } from "@/lib/products";
import { SITE_URL, pageMetadata } from "@/lib/site";

/**
 * Guards the SEO surface mechanically rather than by remembering.
 *
 * CLAUDE.md makes "new route ⇒ add it to sitemap.ts, give it metadata, decide
 * whether it should be indexed" a standing requirement. A standing requirement
 * that only a human checks is one that eventually gets skipped on the busy
 * week, so this test walks src/app and fails when a new public page shows up
 * that the sitemap does not know about.
 */

const APP_DIR = join(process.cwd(), "src", "app");

/**
 * Routes that exist and are deliberately NOT in the sitemap. Adding to this
 * list is how you record the decision; the test failing is how you are made to
 * make it.
 */
const INTENTIONALLY_UNLISTED = new Set([
  "/success", // noindex: post-purchase, carries a PaymentIntent id
  "/admin", // noindex + login + customer PII
  "/admin/login",
  "/admin/coupons",
  "/admin/orders/[id]",
]);

/** Every directory under src/app that renders a page.tsx, as a route path. */
function discoverPageRoutes(dir = APP_DIR, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Route groups and private folders don't contribute a path segment.
    if (entry.startsWith("_") || entry.startsWith("(")) continue;
    const path = `${prefix}/${entry}`;
    if (existsSync(join(full, "page.tsx"))) routes.push(path);
    routes.push(...discoverPageRoutes(full, path));
  }
  return routes;
}

const sitemapPaths = new Set(
  sitemap().map((e) => e.url.replace(SITE_URL, "") || "/")
);

describe("sitemap coverage", () => {
  it("lists the storefront", () => {
    expect(sitemapPaths.has("/")).toBe(true);
  });

  it("lists every kit, derived from KIT_TIERS rather than hand-typed", () => {
    for (const tier of KIT_TIERS) {
      expect(sitemapPaths.has(`/kits/${tier.slug}`)).toBe(true);
    }
  });

  it("lists every public page, or the page is explicitly excluded", () => {
    // The failure message names the offending route, so the fix is obvious:
    // add it to sitemap.ts, or add it to INTENTIONALLY_UNLISTED with a reason.
    const dynamic = /\[.+\]/;
    const missing = discoverPageRoutes()
      .filter((r) => !dynamic.test(r))
      .filter((r) => !r.startsWith("/api"))
      .filter((r) => !INTENTIONALLY_UNLISTED.has(r))
      .filter((r) => !sitemapPaths.has(r));

    expect(missing).toEqual([]);
  });

  it("emits no duplicate URLs", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBe(new Set(urls).size);
  });

  it("emits absolute URLs on the canonical www host", () => {
    for (const entry of sitemap()) {
      expect(entry.url.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });
});

describe("kit identity", () => {
  it("has unique slugs — they are indexed URLs and feed links", () => {
    const slugs = KIT_TIERS.map((t) => t.slug);
    expect(slugs.length).toBe(new Set(slugs).size);
  });

  it("has unique SKUs — one id reconciles GA4, the feed and JSON-LD", () => {
    const skus = KIT_TIERS.map((t) => t.sku);
    expect(skus.length).toBe(new Set(skus).size);
  });

  it("carries real image dimensions, so nothing reflows as art loads", () => {
    for (const tier of KIT_TIERS) {
      expect(tier.image.width).toBeGreaterThan(0);
      expect(tier.image.height).toBeGreaterThan(0);
      expect(tier.image.alt.length).toBeGreaterThan(20);
    }
  });

  it("keeps prices and shipping thresholds out of the marketing prose", () => {
    // Prose that repeats a number is prose that contradicts the checkout after
    // the next price change. Descriptions must stay free of dollar figures.
    for (const tier of KIT_TIERS) {
      expect(tier.description).not.toMatch(/\$\d/);
    }
  });
});

describe("pageMetadata", () => {
  it("always sets a self-referencing canonical", () => {
    const meta = pageMetadata({
      title: "T",
      description: "D",
      path: "/example",
    });
    expect(meta.alternates?.canonical).toBe("/example");
  });

  it("only emits a robots directive when noindex was asked for", () => {
    expect(
      pageMetadata({ title: "T", description: "D", path: "/a" }).robots
    ).toBeUndefined();
    expect(
      pageMetadata({ title: "T", description: "D", path: "/a", noindex: true })
        .robots
    ).toEqual({ index: false, follow: false });
  });
});

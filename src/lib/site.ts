/**
 * Canonical site identity, shared by the metadata in layout.tsx, the
 * sitemap/robots routes, and the JSON-LD in StructuredData.tsx so the three
 * can't drift apart.
 *
 * SITE_URL must be the canonical host with no trailing slash. The apex
 * (theslimecompany.com) 307s to www at the DNS/Vercel layer, so www is the
 * form Google should index and every absolute URL we emit uses it.
 */
export const SITE_URL = "https://www.theslimecompany.com";

export const SITE_NAME = "The Slime Co";

export const SITE_TAGLINE = "Just add water.";

export const SITE_DESCRIPTION =
  "Instant slime powder kits — just add water. Make 20 to 80 gallons of thick, colorful slime for youth groups, church events, parties, camps, and content shoots. Ships from Florida.";

/** Legal entity behind the brand, used in Organization structured data. */
export const LEGAL_NAME = "Dossco Designs LLC";

export const CONTACT_EMAIL = "hello@theslimeco.com";

/** 1200×630 share card. Absolute URLs are required by OG/Twitter consumers. */
export const OG_IMAGE = `${SITE_URL}/og.jpg`;

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

import type { Metadata } from "next";

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

export const CONTACT_EMAIL = "info@theslimecompany.com";

/** 1200×630 share card. Absolute URLs are required by OG/Twitter consumers. */
export const OG_IMAGE = `${SITE_URL}/og.jpg`;

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Page-level metadata, so every route declares a title, a description and a
 * self-referencing canonical the same way.
 *
 * Canonical matters more than it looks: the apex 307s to www and any page can
 * be reached with tracking parameters attached, both of which split ranking
 * signals across duplicate URLs unless the page names its own address.
 *
 * `noindex` is an explicit argument rather than a default, because CLAUDE.md
 * requires every new route to make that call deliberately.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  image,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  image?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image ? absoluteUrl(image) : OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url,
      title,
      description,
      locale: "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

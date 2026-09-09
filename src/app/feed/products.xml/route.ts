import { KIT_TIERS, GOOGLE_PRODUCT_CATEGORY } from "@/lib/products";
import {
  SHIPPING_FLAT_CENTS,
  SHIPPING_FREE_THRESHOLD_CENTS,
} from "@/lib/pricing";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

/**
 * Google Merchant Center product feed, served at /feed/products.xml.
 *
 * Merchant Center can scrape our Product JSON-LD instead, but an explicit feed
 * is worth having: it is the only way to state the things JSON-LD has no field
 * for — `identifier_exists`, `google_product_category`, shipping weight — and
 * it fails loudly with a named error instead of quietly under-populating.
 *
 * WHY `identifier_exists: no`: these kits are our own product with no
 * manufacturer barcode. Without this field Merchant Center rejects every item
 * for a missing GTIN, which is the single most common reason a small
 * merchant's first feed comes back 100% disapproved.
 *
 * Every value is read from products.ts and pricing.ts. A feed that disagrees
 * with the landing page's visible price is not a warning, it is an account
 * suspension — Google fetches the page and compares.
 */

export const dynamic = "force-static";
/** Re-generated daily; Merchant Center re-fetches on roughly that cadence. */
export const revalidate = 86400;

/** XML-escape. Descriptions carry em dashes and apostrophes. */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const usd = (cents: number) => `${(cents / 100).toFixed(2)} USD`;

export function GET() {
  const items = KIT_TIERS.map((tier) => {
    const link = absoluteUrl(`/kits/${tier.slug}`);
    return `    <item>
      <g:id>${xml(tier.sku)}</g:id>
      <title>${xml(`${tier.gallons} Gallon Slime Powder Kit — ${tier.name}`)}</title>
      <description>${xml(tier.description)}</description>
      <link>${xml(link)}</link>
      <g:image_link>${xml(absoluteUrl(tier.image.src))}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${usd(tier.basePriceCents)}</g:price>
      <g:condition>new</g:condition>
      <g:brand>${xml(SITE_NAME)}</g:brand>
      <g:mpn>${xml(tier.sku)}</g:mpn>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${xml(GOOGLE_PRODUCT_CATEGORY)}</g:google_product_category>
      <g:product_type>${xml(`Slime Powder Kits > ${tier.gallons} Gallon`)}</g:product_type>
      <g:age_group>kids</g:age_group>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard</g:service>
        <g:price>${usd(
          tier.basePriceCents >= SHIPPING_FREE_THRESHOLD_CENTS
            ? 0
            : SHIPPING_FLAT_CENTS
        )}</g:price>
      </g:shipping>
      <g:shipping_label>flat_rate</g:shipping_label>
      <g:max_handling_time>3</g:max_handling_time>
    </item>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(SITE_NAME)}</title>
    <link>${xml(SITE_URL)}</link>
    <description>${xml(SITE_DESCRIPTION)}</description>
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}

import { KIT_TIERS } from "@/lib/products";
import {
  SHIPPING_FLAT_CENTS,
  SHIPPING_FREE_THRESHOLD_CENTS,
} from "@/lib/pricing";
import {
  CONTACT_EMAIL,
  LEGAL_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

/**
 * JSON-LD for the storefront, emitted as one @graph so the nodes can
 * cross-reference by @id instead of repeating themselves.
 *
 * Prices, shipping and the free-shipping threshold are read from the same
 * modules the checkout uses — structured data that disagrees with the visible
 * price is a Merchant Center disapproval, so it must never be hand-typed here.
 *
 * Deliberately NOT included: FAQPage. Google restricted FAQ rich results to
 * government and health sites in 2023, so the markup would be inert weight.
 */

/** Per-tier art + a stable SKU, keyed by gallon size. */
const TIER_META: Record<number, { image: string; sku: string }> = {
  20: { image: "/photos/youth-groups-1200.webp", sku: "SLIME-KIT-20G" },
  40: { image: "/photos/events-parties-1024.webp", sku: "SLIME-KIT-40G" },
  80: { image: "/photos/content-creators-1200.webp", sku: "SLIME-KIT-80G" },
};

const usd = (cents: number) => (cents / 100).toFixed(2);

/** Valid-through date for the offers — rolls a year out from build time. */
function priceValidUntil(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const shippingDetails = {
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    value: usd(SHIPPING_FLAT_CENTS),
    currency: "USD",
  },
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "US",
  },
  freeShippingThreshold: {
    "@type": "DeliveryChargeSpecification",
    eligibleTransactionVolume: {
      "@type": "PriceSpecification",
      price: usd(SHIPPING_FREE_THRESHOLD_CENTS),
      priceCurrency: "USD",
    },
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 3,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 5,
      maxValue: 7,
      unitCode: "DAY",
    },
  },
};

const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
};

export default function StructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      legalName: LEGAL_NAME,
      url: SITE_URL,
      email: CONTACT_EMAIL,
      description: SITE_DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/og.jpg"),
        width: 1200,
        height: 630,
      },
      areaServed: { "@type": "Country", name: "United States" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: `${SITE_NAME} | Instant Slime Powder Kits`,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl("/og.jpg") },
    },
    ...KIT_TIERS.map((tier) => {
      const meta = TIER_META[tier.gallons];
      return {
        "@type": "Product",
        "@id": `${SITE_URL}/#product-${tier.gallons}g`,
        name: `${SITE_NAME} ${tier.name} — ${tier.gallons} Gallon Slime Powder Kit`,
        description: `${tier.tagline}. Makes ${tier.gallons} gallons of thick, colorful slime from powder — just add water.`,
        sku: meta?.sku,
        image: meta ? absoluteUrl(meta.image) : absoluteUrl("/og.jpg"),
        brand: { "@type": "Brand", name: SITE_NAME },
        category: "Toys & Games > Novelty & Gag Toys > Slime",
        offers: {
          "@type": "Offer",
          url: `${SITE_URL}/#products`,
          price: tier.basePrice.toFixed(2),
          priceCurrency: "USD",
          priceValidUntil: priceValidUntil(),
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": `${SITE_URL}/#organization` },
          shippingDetails,
          hasMerchantReturnPolicy: returnPolicy,
        },
      };
    }),
  ];

  return (
    <script
      type="application/ld+json"
      // Server-rendered from constants above; no user input reaches this string.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}

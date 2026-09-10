import {
  GOOGLE_PRODUCT_CATEGORY,
  KIT_TIERS,
  PRICE_VALID_FROM,
  type KitTier,
} from "@/lib/products";
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
 * JSON-LD, split by scope. Nodes cross-reference by @id rather than repeating
 * themselves.
 *
 * THE SPLIT MATTERS. Organization and WebSite describe the site and belong on
 * every page, so they render from the root layout. The Product nodes describe
 * three specific things for sale and belong ONLY where those things are the
 * subject: the home page lineup, and each kit's own page.
 *
 * Emitting all three Products site-wide (which is what a single site-wide
 * block did) put four Product nodes on every kit page — the page's own product
 * plus its two siblings — leaving Google to guess which one the page is
 * actually about. On a page whose whole job is to rank for one kit, that guess
 * is the thing you least want to leave open.
 *
 * Prices, shipping and the free-shipping threshold are read from the same
 * modules the checkout uses — structured data that disagrees with the visible
 * price is a Merchant Center disapproval, so it must never be hand-typed here.
 *
 * Deliberately NOT included: FAQPage. Google restricted FAQ rich results to
 * government and health sites in 2023, so the markup would be inert weight.
 */

/** Serialize a graph to a JSON-LD script tag. */
function JsonLd({ graph }: { graph: object[] }) {
  return (
    <script
      type="application/ld+json"
      // Server-rendered from module constants; no user input reaches this.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}

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

/**
 * Mirrors /shipping-returns: 30 days, by mail, and on a change-of-mind return
 * the buyer arranges and pays their own return shipping.
 *
 * `ReturnFeesCustomerResponsibility`, NOT `ReturnShippingFees` — the two are
 * not synonyms. `ReturnShippingFees` means the merchant charges a return
 * shipping fee of a stated amount, which is why Google requires
 * `returnShippingFeesAmount` alongside it and why the Rich Results Test flags
 * that field as missing when you use it. We charge no such fee; the customer
 * pays a carrier directly, and we cannot know what that costs. Inventing a
 * number to silence the warning would be a false claim about our own policy,
 * so the fix is the accurate enum, which needs no amount.
 */
const returnPolicy = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
};


/**
 * One Product node. Exported because /kits/[slug] emits the SAME node for its
 * own kit — two hand-written copies of a product's price is precisely how
 * structured data ends up disagreeing with the page, which is a Merchant
 * Center disapproval rather than a warning.
 *
 * `offers.url` points at the kit's OWN page, not `/#products`. Three products
 * sharing one URL gives Google nothing to rank or list separately.
 */
export function productNode(tier: KitTier) {
  return {
    "@type": "Product",
    "@id": `${SITE_URL}/kits/${tier.slug}#product`,
    name: `${SITE_NAME} ${tier.name} — ${tier.gallons} Gallon Slime Powder Kit`,
    description: tier.description,
    sku: tier.sku,
    mpn: tier.sku,
    image: absoluteUrl(tier.image.src),
    brand: { "@type": "Brand", name: SITE_NAME },
    category: GOOGLE_PRODUCT_CATEGORY,
    audience: { "@type": "PeopleAudience", suggestedMinAge: 5 },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/kits/${tier.slug}`),
      price: tier.basePrice.toFixed(2),
      priceCurrency: "USD",
      validFrom: PRICE_VALID_FROM,
      priceValidUntil: priceValidUntil(),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
      shippingDetails,
      hasMerchantReturnPolicy: returnPolicy,
    },
  };
}

/**
 * Site-wide identity. Rendered from the root layout, so it is correct on the
 * storefront, the kit pages, the guides and the policies alike.
 */
export default function StructuredData() {
  return (
    <JsonLd
      graph={[
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
      ]}
    />
  );
}

/**
 * The storefront's own nodes: the page itself, and the three kits it lists.
 * Rendered from src/app/page.tsx, NOT the layout — see the split note above.
 */
export function HomeStructuredData() {
  return (
    <JsonLd
      graph={[
        {
          "@type": "WebPage",
          "@id": `${SITE_URL}/#webpage`,
          url: `${SITE_URL}/`,
          name: `${SITE_NAME} | Instant Slime Powder Kits`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          about: { "@id": `${SITE_URL}/#organization` },
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: absoluteUrl("/og.jpg"),
          },
        },
        ...KIT_TIERS.map((tier) => productNode(tier)),
      ]}
    />
  );
}

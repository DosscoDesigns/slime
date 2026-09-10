// Single source of truth for kit + add-on pricing. Imported by the
// KitWizard UI (so the client renders the same numbers) AND by the server
// checkout routes (so the charged price is recomputed server-side and the
// client can never dictate it). Never trust client-supplied prices.

export type SlimeColor = "red" | "green" | "blue" | "yellow";

export interface AddonDef {
  id: string;
  name: string;
  description: string;
  retailPrice: number; // "regular" price
  retailPriceCents: number;
  kitPrice: number; // discounted kit price
  kitPriceCents: number;
  icon: string;
  suggestedPer20: number;
  /**
   * Optional quantity break. Every complete bundle of `quantity` costs
   * `priceCents`; any remainder is charged at kitPriceCents each.
   *
   * Nothing sets this today — buckets used it before they were dropped as an
   * add-on (they can't be shipped economically: 8 nested pails bill ~41 lb
   * dimensional, ~$90 to the west coast against $48 of product). Kept because
   * sprayers are the obvious next candidate at 12 for $18.
   */
  bulk?: { quantity: number; priceCents: number };
}

export const ADDON_DEFS: AddonDef[] = [
  {
    id: "sprayers",
    name: "Pump Sprayers",
    description: "Maximum slime coverage",
    retailPrice: 5,
    retailPriceCents: 500,
    kitPrice: 3,
    kitPriceCents: 300,
    icon: "🔫",
    suggestedPer20: 12,
  },
  {
    id: "mixer",
    name: "Mixing Paddle",
    description: "Attach to any drill for easy mixing",
    retailPrice: 12,
    retailPriceCents: 1200,
    kitPrice: 8,
    kitPriceCents: 800,
    icon: "🔧",
    suggestedPer20: 1,
  },
  {
    id: "goggles",
    name: "Safety Goggles",
    description: "Keep the slime out of your eyes",
    retailPrice: 4,
    retailPriceCents: 400,
    kitPrice: 2,
    kitPriceCents: 200,
    icon: "🥽",
    suggestedPer20: 10,
  },
];

export const ADDONS_BY_ID: Record<string, AddonDef> = Object.fromEntries(
  ADDON_DEFS.map((a) => [a.id, a])
);

export interface KitTier {
  gallons: number;
  name: string;
  tagline: string;
  basePrice: number;
  basePriceCents: number;
  color: "lime" | "purple" | "pink";
  popular?: boolean;
  /**
   * URL segment for the kit's own page (/kits/<slug>). These are INDEXED URLs
   * and they are the `link` in the Google product feed — changing one without
   * a 301 drops its ranking and breaks the Merchant Center item.
   */
  slug: string;
  /**
   * Stable merchant SKU. The same string is the Product JSON-LD `sku`, the
   * feed's `g:id`, and the GA4 `item_id`, so a row in Merchant Center, a row
   * in GA4 and an order line all reconcile against one identifier. Never
   * recycle a retired SKU for a different product.
   */
  sku: string;
  /**
   * Primary product image. Feeds the kit page hero, the feed's `g:image_link`
   * and the Product JSON-LD `image`.
   *
   * width/height are the REAL pixel dimensions of `src`, carried so every
   * render can reserve space — layout shift is a Core Web Vitals input and
   * therefore a ranking one. `alt` is written against the full-size original.
   */
  image: {
    src: string;
    /** Narrower derivative for the srcSet, so phones don't pull 1200px. */
    srcSmall: string;
    width: number;
    height: number;
    alt: string;
  };
  /** Long-form copy for the product page and the feed `<description>`.
   *  Deliberately free of prices and shipping thresholds — those live in
   *  pricing.ts, and prose that repeats them is prose that drifts. */
  description: string;
}

export const KIT_TIERS: KitTier[] = [
  {
    gallons: 20,
    name: "Backyard Bash",
    tagline: "Perfect for 10–25 people",
    basePrice: 21.99,
    basePriceCents: 2199,
    color: "lime",
    slug: "20-gallon-slime-powder-kit",
    sku: "SLIME-KIT-20G",
    image: {
      src: "/photos/youth-groups-1200.webp",
      srcSmall: "/photos/youth-groups-700.webp",
      width: 1200,
      height: 801,
      alt: "A youth group out on the field mid-event, everyone soaked in bright green and purple slime",
    },
    description:
      "Makes 20 gallons of thick, brightly colored slime from our proprietary " +
      "powder \u2014 enough for a backyard party, a youth group night, or a " +
      "classroom fundraiser of about 10\u201325 people. Just add water and it " +
      "thickens in minutes: no cooking, no measuring, no mixing station. " +
      "Ships from Florida.",
  },
  {
    gallons: 40,
    name: "Block Party",
    tagline: "Great for 25–50 people",
    basePrice: 37.99,
    basePriceCents: 3799,
    color: "purple",
    popular: true,
    slug: "40-gallon-slime-powder-kit",
    sku: "SLIME-KIT-40G",
    image: {
      src: "/photos/events-parties-1024.webp",
      srcSmall: "/photos/events-parties-700.webp",
      width: 1024,
      height: 768,
      alt: "A crowd at an outdoor party being covered in slime from pump sprayers",
    },
    description:
      "Makes 40 gallons of thick, brightly colored slime \u2014 the size most " +
      "groups actually want. Built for 25\u201350 people: church events, school " +
      "fundraisers, color runs and summer camp game nights. Just add water; " +
      "the premium powder hydrates in minutes and stays thick through a whole " +
      "event. Ships from Florida.",
  },
  {
    gallons: 80,
    name: "Total Mayhem",
    tagline: "Built for 50–100+ people",
    basePrice: 67.99,
    basePriceCents: 6799,
    color: "pink",
    slug: "80-gallon-slime-powder-kit",
    sku: "SLIME-KIT-80G",
    image: {
      src: "/photos/content-creators-1200.webp",
      srcSmall: "/photos/content-creators-700.webp",
      width: 1200,
      height: 801,
      alt: "A large crowd on an open field drenched in colorful slime during a big event finale",
    },
    description:
      "Makes 80 gallons of thick, brightly colored slime \u2014 enough to slime " +
      "a crowd of 50\u2013100+ and still have plenty left for the video. Built " +
      "for big fundraisers, camp finales, festival booths and content shoots. " +
      "Just add water. Ships from Florida.",
  },
];

export const KIT_TIERS_BY_GALLONS: Record<number, KitTier> = Object.fromEntries(
  KIT_TIERS.map((t) => [t.gallons, t])
);

export const KIT_TIERS_BY_SLUG: Record<string, KitTier> = Object.fromEntries(
  KIT_TIERS.map((t) => [t.slug, t])
);

/**
 * The date the current kit prices took effect (ISO 8601, no time — a date is
 * what Google's `validFrom` example uses and what we can actually defend).
 *
 * Emitted as `offers.validFrom` in the Product JSON-LD, paired with a rolling
 * `priceValidUntil`. Google lists both as recommended Offer fields and the
 * Rich Results Test flags a missing `validFrom` as a non-critical issue.
 *
 * 🚨 BUMP THIS WHEN YOU REPRICE. It is a public claim about when this price
 * started; leaving it stale after a price change makes the structured data
 * assert a price history that did not happen. Last reprice: 0d581a9,
 * "Reprice kits to match Amazon: 20G $21.99, 40G $37.99, 80G $67.99".
 */
export const PRICE_VALID_FROM = "2026-09-03";

/**
 * Google product taxonomy for every kit. Merchant Center will guess a category
 * if this is omitted, and it guesses badly for novelty goods — an explicit
 * value keeps the items in the same bucket competitors bid and rank in.
 */
export const GOOGLE_PRODUCT_CATEGORY =
  "Toys & Games > Novelty & Gag Toys > Slime";

export interface KitAddonInput {
  id: string;
  quantity: number;
}

export interface KitConfigInput {
  gallons?: number;
  color?: string;
  addons?: KitAddonInput[];
}

function toQty(n: unknown): number {
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : 0;
}

/**
 * Recompute the trusted unit price (cents) for one configured kit from its
 * gallon tier + add-on selections. Throws on an unknown tier or add-on.
 * Client-supplied prices are ignored entirely.
 */
/**
 * Price one add-on line, honouring any quantity break.
 *
 * With a bulk of 8 @ $48 and a unit of $8, 12 units = one $48 bundle plus 4
 * singles. This is the single source of truth for add-on line pricing — the
 * KitWizard and CartProvider import it too, so what the customer sees is what
 * the server charges.
 */
export function addonLineCents(addon: AddonDef, quantity: number): number {
  const q = toQty(quantity);
  if (q === 0) return 0;
  if (!addon.bulk) return addon.kitPriceCents * q;
  const bundles = Math.floor(q / addon.bulk.quantity);
  const remainder = q % addon.bulk.quantity;
  return bundles * addon.bulk.priceCents + remainder * addon.kitPriceCents;
}

export function priceKitCents(config: KitConfigInput): number {
  const tier = KIT_TIERS_BY_GALLONS[Number(config.gallons)];
  if (!tier) {
    throw new Error(`Unknown kit size: ${config.gallons}`);
  }
  let cents = tier.basePriceCents;
  for (const addon of config.addons ?? []) {
    const def = ADDONS_BY_ID[addon.id];
    if (!def) {
      throw new Error(`Unknown add-on: ${addon.id}`);
    }
    cents += addonLineCents(def, addon.quantity);
  }
  return cents;
}

/** Human-readable line label, derived server-side (not client-supplied). */
export function kitLineName(config: KitConfigInput): string {
  const tier = KIT_TIERS_BY_GALLONS[Number(config.gallons)];
  const base = tier ? `${tier.name} — ${tier.gallons}G` : `Kit ${config.gallons}G`;
  const colorLabel =
    config.color === "one-of-each" ? "one of each" : config.color;
  const addonParts = (config.addons ?? [])
    .filter((a) => toQty(a.quantity) > 0 && ADDONS_BY_ID[a.id])
    .map((a) => `${toQty(a.quantity)}× ${ADDONS_BY_ID[a.id].name}`);
  const suffix = [colorLabel, ...addonParts].filter(Boolean).join(", ");
  return (suffix ? `${base} (${suffix})` : base).slice(0, 90);
}

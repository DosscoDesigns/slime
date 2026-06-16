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
}

export const ADDON_DEFS: AddonDef[] = [
  {
    id: "buckets",
    name: "5-Gallon Buckets",
    description: "Mix your slime right in the bucket",
    retailPrice: 8,
    retailPriceCents: 800,
    kitPrice: 4,
    kitPriceCents: 400,
    icon: "🪣",
    suggestedPer20: 4,
  },
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
}

export const KIT_TIERS: KitTier[] = [
  {
    gallons: 20,
    name: "Backyard Bash",
    tagline: "Perfect for 10–25 people",
    basePrice: 15,
    basePriceCents: 1500,
    color: "lime",
  },
  {
    gallons: 40,
    name: "Block Party",
    tagline: "Great for 25–50 people",
    basePrice: 28,
    basePriceCents: 2800,
    color: "purple",
    popular: true,
  },
  {
    gallons: 80,
    name: "Total Mayhem",
    tagline: "Built for 50–100+ people",
    basePrice: 50,
    basePriceCents: 5000,
    color: "pink",
  },
];

export const KIT_TIERS_BY_GALLONS: Record<number, KitTier> = Object.fromEntries(
  KIT_TIERS.map((t) => [t.gallons, t])
);

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
    cents += def.kitPriceCents * toQty(addon.quantity);
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

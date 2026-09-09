/**
 * GA4 e-commerce item mapping. Pure — no React, no browser, no vendor SDK.
 *
 * This is deliberately a separate module from analytics.ts. analytics.ts is a
 * client module (it imports @next/third-parties), and the Stripe webhook needs
 * this same mapping to build the server-side `purchase` event. Importing the
 * client module from a route handler would drag a client component into server
 * code; splitting the pure part out is what keeps both sides honest about
 * using ONE mapping, which is the only reason GA4's numbers reconcile with
 * Stripe's.
 */

import { ADDONS_BY_ID, addonLineCents, type KitTier } from "@/lib/products";
import { SITE_NAME } from "@/lib/site";

export const GA_CURRENCY = "USD";
export const GA_ITEM_CATEGORY = "Slime Powder Kits";
export const GA_ADDON_CATEGORY = "Slime Kit Add-ons";

/** GA4's standard e-commerce item shape. */
export interface Ga4Item {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

/**
 * The shape this module needs out of a cart line. Declared structurally rather
 * than importing CartItem so a server caller can hand it a plain object.
 */
export interface TrackableCartItem {
  priceCents: number;
  quantity: number;
  gallons?: number;
  color?: string;
  addons?: { id: string; quantity: number }[];
}

const money = (cents: number) => Math.round(cents) / 100;

/** `SLIME-KIT-40G` for a 40-gallon kit, matching KitTier.sku. */
export function kitSku(gallons?: number): string {
  return gallons ? `SLIME-KIT-${gallons}G` : "SLIME-KIT";
}

export function addonSku(id: string): string {
  return `ADDON-${id.toUpperCase()}`;
}

/**
 * Map one configured kit onto GA4 items: the kit at its BASE price, plus one
 * line per add-on.
 *
 * Splitting add-ons out rather than rolling them into the kit price is the
 * whole point — it is what makes "what fraction of 40G buyers add sprayers"
 * answerable. The kit price is therefore the base price, not item.priceCents,
 * which already includes the add-ons.
 *
 * Add-on unit price is derived from addonLineCents() rather than kitPriceCents
 * so a quantity break shows up at the price actually charged; summing the
 * undiscounted unit would make GA4's revenue disagree with Stripe's.
 */
export function cartItemToGa4Items(item: TrackableCartItem): Ga4Item[] {
  const kitQty = Math.max(1, item.quantity);
  const addons = (item.addons ?? []).filter(
    (a) => ADDONS_BY_ID[a.id] && a.quantity > 0
  );

  const addonCentsTotal = addons.reduce(
    (sum, a) => sum + addonLineCents(ADDONS_BY_ID[a.id], a.quantity),
    0
  );
  const baseCents = item.priceCents - addonCentsTotal;

  const kitLine: Ga4Item = {
    item_id: kitSku(item.gallons),
    item_name: item.gallons
      ? `${item.gallons} Gallon Slime Powder Kit`
      : "Slime Powder Kit",
    item_brand: SITE_NAME,
    item_category: GA_ITEM_CATEGORY,
    ...(item.color ? { item_variant: item.color } : {}),
    price: money(baseCents),
    quantity: kitQty,
  };

  const addonLines: Ga4Item[] = addons.map((a) => {
    const def = ADDONS_BY_ID[a.id];
    const lineCents = addonLineCents(def, a.quantity);
    return {
      item_id: addonSku(a.id),
      item_name: def.name,
      item_brand: SITE_NAME,
      item_category: GA_ADDON_CATEGORY,
      // Effective unit price, so a bulk break is reflected rather than hidden.
      price: money(lineCents / a.quantity),
      quantity: a.quantity * kitQty,
    };
  });

  return [kitLine, ...addonLines];
}

export function cartToGa4Items(items: TrackableCartItem[]): Ga4Item[] {
  return items.flatMap(cartItemToGa4Items);
}

export function tierToGa4Item(tier: KitTier, quantity = 1): Ga4Item {
  return {
    item_id: tier.sku,
    item_name: `${tier.name} — ${tier.gallons} Gallon Slime Powder Kit`,
    item_brand: SITE_NAME,
    item_category: GA_ITEM_CATEGORY,
    price: tier.basePrice,
    quantity,
  };
}

export function itemsValue(items: Ga4Item[]): number {
  return Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Compact encoding for Stripe metadata
 * ------------------------------------------------------------------ */

/**
 * Stripe metadata values cap at 500 characters, so the purchase items are
 * stored as `[id, unitPrice, qty]` triples and the names are rebuilt from
 * products.ts on the way out. That is roughly 30 characters a line instead of
 * 90, which keeps even an unusually large cart inside the cap.
 *
 * Lines beyond the cap are dropped rather than truncated mid-JSON: a partial
 * array would throw on parse and lose the WHOLE purchase event, while a short
 * array only loses item detail. The order total is taken from the
 * PaymentIntent either way, so revenue stays correct regardless.
 */
const METADATA_VALUE_LIMIT = 500;

export function encodeGa4Items(items: Ga4Item[]): string {
  const triples = items.map((i) => [i.item_id, i.price, i.quantity]);
  let encoded = JSON.stringify(triples);
  while (encoded.length > METADATA_VALUE_LIMIT && triples.length > 0) {
    triples.pop();
    encoded = JSON.stringify(triples);
  }
  return encoded;
}

export function decodeGa4Items(encoded: string | undefined | null): Ga4Item[] {
  if (!encoded) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: Ga4Item[] = [];
  for (const row of parsed) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const [id, price, quantity] = row as [string, number, number];
    if (typeof id !== "string") continue;

    const addonId = id.startsWith("ADDON-")
      ? id.slice("ADDON-".length).toLowerCase()
      : null;
    const addon = addonId ? ADDONS_BY_ID[addonId] : undefined;
    const gallons = id.startsWith("SLIME-KIT-")
      ? Number(id.slice("SLIME-KIT-".length).replace(/G$/, ""))
      : NaN;

    items.push({
      item_id: id,
      item_name: addon
        ? addon.name
        : Number.isFinite(gallons)
          ? `${gallons} Gallon Slime Powder Kit`
          : id,
      item_brand: SITE_NAME,
      item_category: addon ? GA_ADDON_CATEGORY : GA_ITEM_CATEGORY,
      price: Number(price) || 0,
      quantity: Number(quantity) || 1,
    });
  }
  return items;
}

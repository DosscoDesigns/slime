// Single source of truth for shipping + tax, shared by the checkout
// route (initial PaymentIntent) and the update-amount route (recompute on
// address change). Mirrors rkpm's flat-rate, ship-to-driven approach.

import { priceKitCents, kitLineName } from "./products";

/** Flat shipping fee (cents) applied to orders below the free threshold. */
export const SHIPPING_FLAT_CENTS = 599;

/**
 * Order subtotal (cents) at/above which shipping is free.
 *
 * Set at $100 deliberately. At the old $50 the threshold sat exactly on the
 * 80-gallon kit's base price, so every Total Mayhem order shipped free on its
 * own and a 40-gallon kit got there with almost any add-on — which meant the
 * flat fee only ever applied to a bare 20-gallon kit. $100 makes add-on
 * orders actually carry shipping.
 */
export const SHIPPING_FREE_THRESHOLD_CENTS = 10000;

/**
 * Florida sales tax rate. Dossco Designs / The Slime Co has nexus in FL
 * only, so tax is collected solely on FL ship-to addresses. 7.5% is a flat
 * approximation (FL is 6% state + 0–1.5% county surtax) — matches rkpm.
 */
export const FL_TAX_RATE = 0.075;

export interface CartLineInput {
  id: string;
  quantity: number;
  name?: string;
  subtitle?: string;
  priceCents?: number;
  gallons?: number;
  color?: string;
  addons?: { id: string; name: string; priceCents: number; quantity: number }[];
}

export interface PricedCart {
  subtotalCents: number;
  /** Compact line items persisted to PI metadata for the order email. */
  lines: { n: string; q: number; c: number }[];
  description: string;
}

/**
 * Validate and price the cart. The per-item price is RECOMPUTED server-side
 * from each kit's gallon tier + add-on selection (see priceKitCents) — the
 * client-supplied priceCents is never trusted, so a tampered cart cannot
 * change what's charged.
 */
export function priceCart(items: CartLineInput[]): PricedCart {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty");
  }

  let subtotalCents = 0;
  const lines: PricedCart["lines"] = [];
  const descriptionParts: string[] = [];

  for (const item of items) {
    const qty =
      Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    // Trusted price + label derived from the kit configuration. Throws on an
    // unknown tier/add-on, which the routes surface as a 400.
    const unitCents = priceKitCents({
      gallons: item.gallons,
      color: item.color,
      addons: item.addons,
    });
    const name = kitLineName({
      gallons: item.gallons,
      color: item.color,
      addons: item.addons,
    });
    subtotalCents += unitCents * qty;
    lines.push({ n: name, q: qty, c: unitCents });
    descriptionParts.push(`${name}${qty > 1 ? ` x${qty}` : ""}`);
  }

  if (subtotalCents === 0) {
    throw new Error("Cart is empty");
  }

  return {
    subtotalCents,
    lines,
    description: descriptionParts.join(", ").slice(0, 500),
  };
}

/** Shipping: free at/above the threshold, flat fee below. */
export function computeShippingCents(subtotalCents: number): number {
  return subtotalCents >= SHIPPING_FREE_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
}

/** FL ship-to only; tax on subtotal (not shipping), mirroring rkpm. */
export function computeTaxCents(
  subtotalCents: number,
  country?: string | null,
  state?: string | null
): number {
  if (country === "US" && state === "FL") {
    return Math.round(subtotalCents * FL_TAX_RATE);
  }
  return 0;
}

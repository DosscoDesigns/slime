/**
 * Live shipping quotes for checkout.
 *
 * The customer's cart becomes one parcel (see parcelForCart), Shippo quotes
 * it to their address, and the result is cut down to the few services in
 * SERVICE_OPTIONS. If Shippo fails for ANY reason the order still goes
 * through, at the flat SHIPPING_FALLBACK_CENTS.
 *
 * Security: the client only ever sends a service ID. Every amount comes from
 * a quote the server made, either just now or cached in the PaymentIntent's
 * metadata, which only our routes can write.
 */

import type { CartLineInput } from "./pricing";
import { SHIPPING_FREE_THRESHOLD_CENTS } from "./pricing";
import {
  ACCESSORY_BOX,
  ADDON_OZ,
  DEFAULT_SERVICE_ID,
  HANDLING_CENTS,
  KIT_BOX,
  KIT_BOX_MAX_POUCHES,
  KIT_CONTENTS_OZ,
  POUCHES_PER_GALLON,
  SERVICE_OPTIONS,
  SHIPPING_FALLBACK_CENTS,
  type Box,
} from "./shipping-config";
import type { Parcel, Rate } from "./shipping";

export interface ShipToAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface ShippingOption {
  id: string;
  label: string;
  /** What the customer pays for this option. */
  cents: number;
  /** The carrier's rate, before handling or free shipping. 0 on the fallback. */
  carrierCents: number;
  days: number | null;
  /** Shippo service-level token, so the admin can buy the same service. */
  token: string;
}

export const FALLBACK_SERVICE_ID = "standard";

export interface PackedParcel extends Parcel {
  boxId: string;
}

/** Packed shipping weight and box for a cart. Unknown add-ons weigh 0 rather than throwing: priceCart already rejects them. */
export function parcelForCart(items: CartLineInput[]): PackedParcel {
  let contentsOz = 0;
  let pouches = 0;
  let hasAddons = false;

  for (const item of items) {
    const qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const gallons = Number(item.gallons);
    contentsOz += (KIT_CONTENTS_OZ[gallons] ?? 0) * qty;
    pouches += Math.round(gallons * POUCHES_PER_GALLON) * qty;
    for (const a of item.addons ?? []) {
      if (!(a.quantity > 0)) continue;
      hasAddons = true;
      contentsOz += (ADDON_OZ[a.id] ?? 0) * a.quantity * qty;
    }
  }

  const box: Box = hasAddons || pouches > KIT_BOX_MAX_POUCHES ? ACCESSORY_BOX : KIT_BOX;
  const weightLb = Math.round(((contentsOz + box.weightOz) / 16) * 100) / 100;
  return {
    boxId: box.id,
    lengthIn: box.lengthIn,
    widthIn: box.widthIn,
    heightIn: box.heightIn,
    weightLb,
  };
}

/**
 * Turn Shippo's rates into the options the customer sees.
 *
 * Under the threshold every option costs its rate plus handling. At or over
 * it, the default (cheapest UPS) is free and every other option costs only
 * its difference from the default. Handling cancels out of the difference.
 */
export function buildOptions(
  rates: Rate[],
  subtotalCents: number,
  opts: { poBox?: boolean } = {}
): ShippingOption[] {
  const free = subtotalCents >= SHIPPING_FREE_THRESHOLD_CENTS;
  // UPS does not deliver to PO boxes, and Shippo quotes it anyway.
  if (opts.poBox) rates = rates.filter((r) => !r.serviceToken.startsWith("ups_"));

  const picked: ShippingOption[] = [];
  for (const svc of SERVICE_OPTIONS) {
    const best = rates
      .filter((r) => svc.tokens.includes(r.serviceToken) && Number.isFinite(r.amountCents))
      .sort((a, b) => a.amountCents - b.amountCents)[0];
    if (!best) continue;
    picked.push({
      id: svc.id,
      label: svc.label,
      cents: best.amountCents + HANDLING_CENTS,
      carrierCents: best.amountCents,
      days: best.estimatedDays,
      token: best.serviceToken,
    });
  }

  // No default service for this address: the first remaining option becomes it.
  const base = picked.find((o) => o.id === DEFAULT_SERVICE_ID) ?? picked[0];
  if (!base) return [];

  // The default goes first so it renders first and is the one picked when the client asks for nothing.
  const ordered = [base, ...picked.filter((o) => o !== base)];
  if (!free) return ordered;
  return ordered.map((o) => ({
    ...o,
    cents: o === base ? 0 : Math.max(0, o.carrierCents - base.carrierCents),
  }));
}

export function fallbackOptions(subtotalCents: number): ShippingOption[] {
  return [
    {
      id: FALLBACK_SERVICE_ID,
      label: "Standard shipping",
      cents: subtotalCents >= SHIPPING_FREE_THRESHOLD_CENTS ? 0 : SHIPPING_FALLBACK_CENTS,
      carrierCents: 0,
      days: null,
      token: "",
    },
  ];
}

/** The option the customer asked for if it exists, otherwise the default (first). */
export function selectOption(options: ShippingOption[], requestedId?: string | null): ShippingOption {
  return options.find((o) => o.id === requestedId) ?? options[0];
}

/** "PO Box 12", "P.O. Box", "Post Office Box". UPS can't deliver to these. */
export function isPoBox(a: ShipToAddress | null | undefined): boolean {
  const re = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;
  return re.test(a?.line1 ?? "") || re.test(a?.line2 ?? "");
}

/** Rates can't be asked for until the address has enough for a carrier to price it. */
export function addressIsQuotable(a: ShipToAddress | null | undefined): a is ShipToAddress {
  return Boolean(a?.line1 && a.city && a.state && a.postal_code && (a.country ?? "US") === "US");
}

/**
 * Cache key: a new quote is needed only when the destination or the parcel
 * changes. Switching service or applying a coupon reuses the cached quote,
 * which is instant and keeps Shippo calls down.
 */
export function quoteKey(a: ShipToAddress, p: PackedParcel): string {
  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return [norm(a.line1), norm(a.city), norm(a.state), norm(a.postal_code).slice(0, 5), p.boxId, p.weightLb].join("|");
}

/**
 * Options compacted for Stripe metadata (500-char limit per value). Labels are
 * not stored; they come back from SERVICE_OPTIONS by id.
 */
export function encodeOptions(options: ShippingOption[]): string {
  return JSON.stringify(options.map((o) => [o.id, o.cents, o.carrierCents, o.days, o.token]));
}

export function decodeOptions(raw: string | undefined | null): ShippingOption[] | null {
  if (!raw) return null;
  try {
    const rows = JSON.parse(raw) as [string, number, number, number | null, string][];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map(([id, cents, carrierCents, days, token]) => ({
      id,
      label:
        SERVICE_OPTIONS.find((s) => s.id === id)?.label ??
        (id === FALLBACK_SERVICE_ID ? "Standard shipping" : id),
      cents,
      carrierCents,
      days,
      token,
    }));
  } catch {
    return null;
  }
}

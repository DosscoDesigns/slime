/**
 * Carrier identity and tracking links.
 *
 * Extracted from order-email.ts so the shipping notice, the admin portal and
 * the Shippo tracking client all build the same URL from the same table. A
 * second copy of a tracking-URL builder is how the email and the portal end up
 * linking a customer and an operator to two different pages for one package.
 *
 * Pure — no Stripe, no Shippo, no React. Safe to import anywhere.
 */

export type Carrier = "usps" | "ups" | "fedex";

export interface CarrierInfo {
  name: string;
  trackUrl: (tracking: string) => string;
}

export const CARRIERS: Record<Carrier, CarrierInfo> = {
  usps: {
    name: "USPS",
    trackUrl: (t) =>
      `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`,
  },
  ups: {
    name: "UPS",
    trackUrl: (t) =>
      `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`,
  },
  fedex: {
    name: "FedEx",
    trackUrl: (t) =>
      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`,
  },
};

/** Narrow an arbitrary string — e.g. one read back out of Stripe metadata. */
export function isCarrier(value: string | null | undefined): value is Carrier {
  return value === "usps" || value === "ups" || value === "fedex";
}

/**
 * Guess the carrier from the tracking number's shape.
 *
 * Only the three carriers we actually ship with. USPS IMpb numbers are 20-22
 * digits and effectively always start with 9 for domestic retail/commercial
 * services; UPS is the unmistakable 1Z prefix; FedEx Express/Ground are 12 or
 * 15 digits. Anything unrecognised falls back to USPS because that is what we
 * ship, and a wrong-but-plausible tracking link is still better than none —
 * callers that know the carrier should pass it explicitly rather than rely on
 * this.
 *
 * Since labels bought through Shippo now persist their real carrier, this is a
 * FALLBACK for orders shipped before that was recorded, not the main path.
 */
export function detectCarrier(tracking: string): Carrier {
  const t = tracking.replace(/\s+/g, "").toUpperCase();
  if (t.startsWith("1Z")) return "ups";
  if (/^\d{20,22}$/.test(t)) return "usps";
  if (/^\d{12}$|^\d{15}$/.test(t)) return "fedex";
  return "usps";
}

/** The carrier's own tracking page for this number. */
export function trackUrl(tracking: string, carrier?: Carrier | null): string {
  return CARRIERS[carrier ?? detectCarrier(tracking)].trackUrl(tracking);
}

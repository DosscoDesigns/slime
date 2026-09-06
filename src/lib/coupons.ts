// Coupon codes. Deliberately a static registry rather than Stripe Coupon
// objects: checkout here uses PaymentIntents + Elements (not Stripe-hosted
// Checkout Sessions), so Stripe's promotion-code machinery isn't in play and
// the discount has to be computed server-side anyway.
//
// The code a customer types is NEVER trusted for an amount — the client sends
// only the code string, and the server looks up what it's worth. See
// priceCart() in pricing.ts.

interface CouponBase {
  /** Canonical code, uppercase. Matching is case-insensitive. */
  code: string;
  /** Optional minimum subtotal (cents) before the code is valid. */
  minSubtotalCents?: number;
  /** Shown in the cart/checkout summary and the order email. */
  label: string;
  /**
   * Redeemable exactly once across the whole store. Enforcement lives in
   * coupon-redemption.ts (Stripe is the ledger) — setting this alone does
   * nothing, the routes must go through resolveOrderTotals().
   */
  singleUse?: boolean;
}

export interface FixedCoupon extends CouponBase {
  kind: "fixed";
  /** Discount in cents. */
  amountCents: number;
}

export interface PercentCoupon extends CouponBase {
  kind: "percent";
  /** Whole percent off the subtotal, 1-100. */
  percentOff: number;
}

export type CouponDef = FixedCoupon | PercentCoupon;

const COUPONS: CouponDef[] = [
  {
    code: "THESLIMECO5",
    kind: "fixed",
    amountCents: 500,
    label: "$5 off",
  },
  {
    code: "SLIMECO20OFF",
    kind: "percent",
    percentOff: 20,
    label: "20% off",
    singleUse: true,
  },
];

const BY_CODE: Record<string, CouponDef> = Object.fromEntries(
  COUPONS.map((c) => [c.code, c])
);

/** Normalize customer input: trim, strip spaces, uppercase. */
export function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, "").toUpperCase() : "";
}

/** Look up a coupon by (normalized) code. Returns null for unknown codes. */
export function lookupCoupon(raw: unknown): CouponDef | null {
  const code = normalizeCode(raw);
  return code ? BY_CODE[code] ?? null : null;
}

export interface CouponResult {
  /** Canonical code actually applied, or null. */
  code: string | null;
  discountCents: number;
  label: string | null;
  /** Customer-facing reason the code was not applied. */
  error: string | null;
}

const NO_COUPON: CouponResult = {
  code: null,
  discountCents: 0,
  label: null,
  error: null,
};

/**
 * What a coupon is worth against a given subtotal, in cents.
 *
 * Percent codes are rounded to the nearest cent, and every kind is clamped to
 * the subtotal so a discount can never exceed what is being bought (a negative
 * line would be rejected by Stripe as an invalid amount).
 */
export function discountCentsFor(
  coupon: CouponDef,
  subtotalCents: number
): number {
  const raw =
    coupon.kind === "percent"
      ? Math.round((subtotalCents * coupon.percentOff) / 100)
      : coupon.amountCents;
  return Math.max(0, Math.min(raw, subtotalCents));
}

/**
 * Resolve a customer-supplied code against a subtotal.
 *
 * The discount is clamped to the subtotal so a total can never go negative,
 * and an empty/absent code is not an error (it just means no coupon).
 */
export function applyCoupon(raw: unknown, subtotalCents: number): CouponResult {
  const code = normalizeCode(raw);
  if (!code) return NO_COUPON;

  const coupon = BY_CODE[code];
  if (!coupon) {
    return { ...NO_COUPON, error: "That code isn't valid." };
  }

  if (
    coupon.minSubtotalCents !== undefined &&
    subtotalCents < coupon.minSubtotalCents
  ) {
    const min = (coupon.minSubtotalCents / 100).toFixed(2);
    return { ...NO_COUPON, error: `This code needs a subtotal of $${min} or more.` };
  }

  return {
    code: coupon.code,
    discountCents: discountCentsFor(coupon, subtotalCents),
    label: coupon.label,
    error: null,
  };
}

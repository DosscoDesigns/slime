/**
 * Coupon usage, read from Stripe.
 *
 * SERVER-ONLY. The registry in coupons.ts says what a code is worth; this says
 * what it has actually cost. Both halves matter — a code's real expense is the
 * discount that was given, not the discount that was offered, and those differ
 * whenever a percentage code meets a small order or a fixed code is clamped to
 * the subtotal.
 */
import type Stripe from "stripe";
import { COUPON_LIST, type CouponDef } from "@/lib/coupons";
import { logError, errorContext } from "@/lib/logger";

export interface CouponUsage {
  code: string;
  label: string;
  singleUse: boolean;
  minSubtotalCents: number | null;
  timesRedeemed: number;
  /** What we actually gave away, summed from succeeded payments. */
  totalDiscountCents: number;
  /** A single-use code that has been spent and will now be refused. */
  spent: boolean;
}

async function usageFor(stripe: Stripe, c: CouponDef): Promise<CouponUsage> {
  const base: CouponUsage = {
    code: c.code,
    label: c.label,
    singleUse: Boolean(c.singleUse),
    minSubtotalCents: c.minSubtotalCents ?? null,
    timesRedeemed: 0,
    totalDiscountCents: 0,
    spent: false,
  };

  // Same guard as coupon-redemption.ts: the code is interpolated into a search
  // query, so it must come from our own registry, never from user input.
  if (!/^[A-Z0-9]+$/.test(c.code)) return base;

  try {
    const res = await stripe.paymentIntents.search({
      query: `status:'succeeded' AND metadata['coupon_code']:'${c.code}'`,
      limit: 100,
    });
    const total = res.data.reduce(
      (sum, pi) => sum + Number(pi.metadata?.discount_cents ?? 0),
      0
    );
    return {
      ...base,
      timesRedeemed: res.data.length,
      totalDiscountCents: Number.isFinite(total) ? total : 0,
      spent: Boolean(c.singleUse) && res.data.length > 0,
    };
  } catch (err) {
    // Report zero rather than failing the page: this screen is informational,
    // and a Stripe hiccup should not black out the whole admin panel.
    logError("coupon usage lookup failed", { coupon_code: c.code, ...errorContext(err) });
    return base;
  }
}

export async function listCouponsWithUsage(stripe: Stripe): Promise<CouponUsage[]> {
  return Promise.all(COUPON_LIST.map((c) => usageFor(stripe, c)));
}

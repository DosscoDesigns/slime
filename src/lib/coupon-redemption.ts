// Single-use coupon enforcement.
//
// This app has no database, so the redemption ledger is Stripe itself: the
// canonical record of "this code was used" is a PaymentIntent that actually
// reached `succeeded` carrying the code in its metadata. That is deliberately
// stronger than a counter we increment ourselves — an abandoned or failed
// checkout does not burn the code, and the ledger cannot drift from what was
// really charged.
//
// KNOWN LIMIT: Stripe's search index is eventually consistent (documented as
// up to a minute behind). Two checkouts completing inside that window can both
// see the code as unused. For a code handed to one customer that is an
// acceptable exposure — the worst case is one extra discounted order — but it
// is NOT a hard guarantee, and a code mailed to a list would need a real
// atomic store instead.

import type Stripe from "stripe";
import { lookupCoupon } from "./coupons";
import {
  computeOrderTotals,
  type OrderTotals,
  type PricedCart,
} from "./pricing";
import { logError, logInfo, errorContext } from "./logger";

/** Shown to the customer when a single-use code has already been redeemed. */
export const ALREADY_REDEEMED_MESSAGE = "This code has already been used.";

/**
 * Has a single-use code already been spent on a succeeded payment?
 *
 * Fails OPEN — a Stripe outage during a customer's checkout must not tell a
 * customer holding a valid code that it is dead. The downside is bounded (one
 * extra discounted order); the downside of failing closed is a lost sale and a
 * support conversation. The failure is logged at error level so it is visible.
 */
export async function isCouponRedeemed(
  stripe: Stripe,
  code: string
): Promise<boolean> {
  // The code is interpolated into a search query, so it must come from our own
  // registry rather than from customer input. Codes are uppercase alphanumeric
  // by construction; anything else means a caller passed raw input through.
  if (!/^[A-Z0-9]+$/.test(code)) {
    logError("refusing to search redemptions for a non-canonical code", {
      code,
    });
    return false;
  }

  try {
    const res = await stripe.paymentIntents.search({
      query: `status:'succeeded' AND metadata['coupon_code']:'${code}'`,
      limit: 1,
    });
    return res.data.length > 0;
  } catch (err) {
    logError("coupon redemption lookup failed — allowing the code", {
      coupon_code: code,
      ...errorContext(err),
    });
    return false;
  }
}

/**
 * Order totals with single-use codes enforced.
 *
 * Both checkout routes call this instead of computeOrderTotals directly, so
 * the pricing math stays in one pure, unit-testable place and the async
 * redemption check wraps it rather than being duplicated per route.
 *
 * A spent code is DROPPED rather than made a hard error: the order still
 * prices correctly at full price and the customer gets a reason in the promo
 * field, instead of a checkout that refuses to load.
 */
export async function resolveOrderTotals(
  stripe: Stripe,
  priced: PricedCart,
  couponCodeRaw: unknown,
  country?: string | null,
  state?: string | null
): Promise<OrderTotals> {
  const coupon = lookupCoupon(couponCodeRaw);

  if (coupon?.singleUse && (await isCouponRedeemed(stripe, coupon.code))) {
    logInfo("single-use coupon refused — already redeemed", {
      coupon_code: coupon.code,
    });
    return {
      ...computeOrderTotals(priced, null, country, state),
      couponError: ALREADY_REDEEMED_MESSAGE,
    };
  }

  return computeOrderTotals(priced, couponCodeRaw, country, state);
}

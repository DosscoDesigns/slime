import { describe, it, expect } from "vitest";
import {
  computeOrderTotals,
  computeShippingCents,
  computeTaxCents,
  priceCart,
  SHIPPING_FLAT_CENTS,
  SHIPPING_FREE_THRESHOLD_CENTS,
  FL_TAX_RATE,
} from "./pricing";
import { KIT_TIERS } from "./products";

/**
 * These cover the money paths. Every assertion here corresponds to a rule
 * written down in pricing.ts — if one fails, either the rule changed
 * deliberately (update the test AND the comment) or an order is being
 * mispriced.
 */

const cart = (gallons: number, quantity = 1) =>
  priceCart([{ id: `kit-${gallons}`, quantity, gallons, color: "rygb" }]);

describe("priceCart", () => {
  it("recomputes price from the tier, ignoring any client-supplied price", () => {
    const tampered = priceCart([
      { id: "kit-20", quantity: 1, gallons: 20, color: "rygb", priceCents: 1 },
    ]);
    expect(tampered.subtotalCents).toBe(KIT_TIERS[0].basePriceCents);
    expect(tampered.subtotalCents).toBeGreaterThan(1);
  });

  it("rejects an empty cart", () => {
    expect(() => priceCart([])).toThrow(/empty/i);
  });

  it("rejects an unknown kit size rather than pricing it at zero", () => {
    expect(() => priceCart([{ id: "x", quantity: 1, gallons: 999 }])).toThrow();
  });

  it("multiplies by quantity", () => {
    const one = cart(20).subtotalCents;
    expect(cart(20, 3).subtotalCents).toBe(one * 3);
  });
});

describe("computeShippingCents", () => {
  it("charges the flat fee below the threshold", () => {
    expect(computeShippingCents(SHIPPING_FREE_THRESHOLD_CENTS - 1)).toBe(
      SHIPPING_FLAT_CENTS
    );
  });

  it("is free exactly at the threshold", () => {
    expect(computeShippingCents(SHIPPING_FREE_THRESHOLD_CENTS)).toBe(0);
  });
});

describe("computeTaxCents", () => {
  it("taxes FL ship-to addresses", () => {
    expect(computeTaxCents(10000, "US", "FL")).toBe(Math.round(10000 * FL_TAX_RATE));
  });

  it("does not tax other states or countries", () => {
    expect(computeTaxCents(10000, "US", "GA")).toBe(0);
    expect(computeTaxCents(10000, "CA", "ON")).toBe(0);
    expect(computeTaxCents(10000, null, null)).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("adds shipping and tax to the subtotal", () => {
    const priced = cart(20);
    const t = computeOrderTotals(priced, null, "US", "GA");
    expect(t.totalCents).toBe(priced.subtotalCents + t.shippingCents + t.taxCents);
  });

  /**
   * The regression this file exists for. Free shipping is decided on the
   * PRE-discount subtotal. Testing it post-discount meant a $5 coupon on a
   * $100-$104.99 order lost free shipping and RAISED the customer's total.
   */
  it("does not let a coupon push an order back under the free-shipping line", () => {
    const priced = { subtotalCents: 10200, lines: [], description: "test" };
    const without = computeOrderTotals(priced, null, "US", "GA");
    const withCoupon = computeOrderTotals(priced, "THESLIMECO5", "US", "GA");

    expect(without.shippingCents).toBe(0);
    expect(withCoupon.shippingCents).toBe(0);
    // The whole point: applying a discount must never increase the total.
    expect(withCoupon.totalCents).toBeLessThan(without.totalCents);
  });

  it("taxes the discounted subtotal, never the shipping", () => {
    const priced = { subtotalCents: 5000, lines: [], description: "test" };
    const t = computeOrderTotals(priced, "THESLIMECO5", "US", "FL");

    expect(t.discountCents).toBe(500);
    expect(t.shippingCents).toBe(SHIPPING_FLAT_CENTS);
    // 4500 discounted subtotal, and shipping is excluded from the base.
    expect(t.taxCents).toBe(Math.round(4500 * FL_TAX_RATE));
    expect(t.taxCents).not.toBe(Math.round((4500 + SHIPPING_FLAT_CENTS) * FL_TAX_RATE));
  });

  it("reports an unknown code as an error without discounting", () => {
    const t = computeOrderTotals(cart(20), "NOPE", "US", "GA");
    expect(t.discountCents).toBe(0);
    expect(t.couponCode).toBeNull();
    expect(t.couponError).toBeTruthy();
  });

  it("never produces a negative total when the discount exceeds the subtotal", () => {
    const priced = { subtotalCents: 300, lines: [], description: "test" };
    const t = computeOrderTotals(priced, "THESLIMECO5", "US", "GA");
    expect(t.discountCents).toBe(300);
    expect(t.totalCents).toBeGreaterThanOrEqual(0);
  });
});

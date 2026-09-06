import { describe, it, expect } from "vitest";
import {
  applyCoupon,
  normalizeCode,
  lookupCoupon,
  discountCentsFor,
} from "./coupons";

/**
 * The code a customer types is never trusted for an amount — only for a
 * lookup. These cover the normalization customers actually trip over
 * (caps lock, a trailing space, a pasted code with a space in the middle).
 */

describe("normalizeCode", () => {
  it("uppercases, trims, and strips internal whitespace", () => {
    expect(normalizeCode("  theslimeco5 ")).toBe("THESLIMECO5");
    expect(normalizeCode("the slime co5")).toBe("THESLIMECO5");
  });

  it("returns empty string for non-string input rather than throwing", () => {
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(42)).toBe("");
    expect(normalizeCode({ code: "THESLIMECO5" })).toBe("");
  });
});

describe("lookupCoupon", () => {
  it("finds a known code case-insensitively", () => {
    expect(lookupCoupon("theslimeco5")?.code).toBe("THESLIMECO5");
  });

  it("returns null for an unknown code", () => {
    expect(lookupCoupon("FREESTUFF")).toBeNull();
  });
});

describe("applyCoupon", () => {
  it("applies a known code", () => {
    const r = applyCoupon("THESLIMECO5", 5000);
    expect(r.discountCents).toBe(500);
    expect(r.code).toBe("THESLIMECO5");
    expect(r.error).toBeNull();
  });

  it("treats an absent code as no coupon, not an error", () => {
    for (const input of ["", "   ", undefined, null]) {
      const r = applyCoupon(input, 5000);
      expect(r.discountCents).toBe(0);
      expect(r.error).toBeNull();
    }
  });

  it("reports an unknown code as a customer-facing error", () => {
    const r = applyCoupon("NOPE", 5000);
    expect(r.discountCents).toBe(0);
    expect(r.error).toBeTruthy();
  });

  /** Clamped so a total can never go negative. */
  it("clamps the discount to the subtotal", () => {
    expect(applyCoupon("THESLIMECO5", 300).discountCents).toBe(300);
  });

  it("never returns a discount for a client-supplied amount", () => {
    // A cart object masquerading as a code must not produce a discount.
    const r = applyCoupon({ amountCents: 999999 }, 5000);
    expect(r.discountCents).toBe(0);
  });
});

describe("percent coupons", () => {
  it("takes 20% off the subtotal, rounded to the nearest cent", () => {
    expect(applyCoupon("SLIMECO20OFF", 7398).discountCents).toBe(1480);
    expect(applyCoupon("SLIMECO20OFF", 10000).discountCents).toBe(2000);
    expect(applyCoupon("SLIMECO20OFF", 2199).discountCents).toBe(440);
  });

  it("scales with the cart instead of being a flat amount", () => {
    const small = applyCoupon("SLIMECO20OFF", 5000).discountCents;
    const large = applyCoupon("SLIMECO20OFF", 50000).discountCents;
    expect(small).toBe(1000);
    expect(large).toBe(10000);
  });

  /**
   * Rounds to the nearest cent, so a discount is not exactly proportional
   * across cart sizes: 20% of $21.99 is $4.398, billed as $4.40, while 20% of
   * $219.90 is exactly $43.98. Pinned so nobody "fixes" it into a floor and
   * silently starts shorting customers a cent.
   */
  it("rounds a half-cent up rather than truncating", () => {
    expect(applyCoupon("SLIMECO20OFF", 2199).discountCents).toBe(440);
    expect(applyCoupon("SLIMECO20OFF", 21990).discountCents).toBe(4398);
  });

  it("is case-insensitive like every other code", () => {
    expect(applyCoupon(" slimeco20off ", 10000).discountCents).toBe(2000);
  });

  it("reports itself as 20% off, for the summary and the order email", () => {
    const r = applyCoupon("SLIMECO20OFF", 10000);
    expect(r.code).toBe("SLIMECO20OFF");
    expect(r.label).toBe("20% off");
    expect(r.error).toBeNull();
  });

  it("never discounts more than the subtotal", () => {
    expect(applyCoupon("SLIMECO20OFF", 1).discountCents).toBeLessThanOrEqual(1);
    expect(applyCoupon("SLIMECO20OFF", 0).discountCents).toBe(0);
  });
});

describe("discountCentsFor", () => {
  it("clamps a hypothetical over-100% code to the subtotal", () => {
    // Guards the arithmetic itself, not the registry: a future 100%+ code
    // must still never produce a negative order total.
    const bogus = {
      code: "BOGUS",
      kind: "percent",
      percentOff: 150,
      label: "bogus",
    } as const;
    expect(discountCentsFor(bogus, 5000)).toBe(5000);
  });
});

import { describe, it, expect } from "vitest";
import { applyCoupon, normalizeCode, lookupCoupon } from "./coupons";

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

import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  isCouponRedeemed,
  resolveOrderTotals,
  ALREADY_REDEEMED_MESSAGE,
} from "./coupon-redemption";
import type { PricedCart } from "./pricing";

/**
 * Stripe is the redemption ledger, so these fake the search endpoint rather
 * than the coupon registry — the behaviour that matters is what happens when
 * the ledger says "used", "unused", and "I can't tell you".
 */
function fakeStripe(search: unknown): Stripe {
  return {
    paymentIntents: { search },
  } as unknown as Stripe;
}

const CART: PricedCart = {
  subtotalCents: 10000,
  lines: [],
  description: "test",
};

describe("isCouponRedeemed", () => {
  it("is redeemed when a succeeded payment already carries the code", async () => {
    const search = vi.fn().mockResolvedValue({ data: [{ id: "pi_1" }] });
    await expect(isCouponRedeemed(fakeStripe(search), "SLIMECO20OFF")).resolves.toBe(
      true
    );
  });

  it("is not redeemed when no succeeded payment carries it", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    await expect(isCouponRedeemed(fakeStripe(search), "SLIMECO20OFF")).resolves.toBe(
      false
    );
  });

  /**
   * Only a SUCCEEDED payment burns the code. Abandoned and failed checkouts
   * must not, or a customer who mistypes a card loses their discount.
   */
  it("only counts succeeded payments", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    await isCouponRedeemed(fakeStripe(search), "SLIMECO20OFF");
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("status:'succeeded'"),
      })
    );
  });

  /** Fails open: an outage must not tell a real customer their code is dead. */
  it("treats a Stripe failure as not-redeemed", async () => {
    const search = vi.fn().mockRejectedValue(new Error("stripe is down"));
    await expect(isCouponRedeemed(fakeStripe(search), "SLIMECO20OFF")).resolves.toBe(
      false
    );
  });

  /** The code is interpolated into a query, so raw input must never reach it. */
  it("refuses a non-canonical code instead of querying with it", async () => {
    const search = vi.fn().mockResolvedValue({ data: [{ id: "pi_1" }] });
    await expect(
      isCouponRedeemed(fakeStripe(search), "X' OR status:'succeeded")
    ).resolves.toBe(false);
    expect(search).not.toHaveBeenCalled();
  });
});

describe("resolveOrderTotals", () => {
  it("applies a single-use code that has not been redeemed", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const t = await resolveOrderTotals(fakeStripe(search), CART, "SLIMECO20OFF");
    expect(t.couponCode).toBe("SLIMECO20OFF");
    expect(t.discountCents).toBe(2000);
    expect(t.couponError).toBeNull();
  });

  it("drops a single-use code that has already been redeemed", async () => {
    const search = vi.fn().mockResolvedValue({ data: [{ id: "pi_1" }] });
    const t = await resolveOrderTotals(fakeStripe(search), CART, "SLIMECO20OFF");
    expect(t.couponCode).toBeNull();
    expect(t.discountCents).toBe(0);
    expect(t.couponError).toBe(ALREADY_REDEEMED_MESSAGE);
  });

  /**
   * A spent code must not break the checkout — the order still has to price
   * correctly at full price, or the customer is stranded.
   */
  it("still prices the order correctly when the code is refused", async () => {
    const search = vi.fn().mockResolvedValue({ data: [{ id: "pi_1" }] });
    const t = await resolveOrderTotals(
      fakeStripe(search),
      CART,
      "SLIMECO20OFF",
      "US",
      "FL"
    );
    expect(t.subtotalCents).toBe(10000);
    expect(t.totalCents).toBe(10000 + t.shippingCents + t.taxCents);
    expect(t.taxCents).toBeGreaterThan(0);
  });

  it("does not hit the redemption ledger for a multi-use code", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const t = await resolveOrderTotals(fakeStripe(search), CART, "THESLIMECO5");
    expect(search).not.toHaveBeenCalled();
    expect(t.discountCents).toBe(500);
  });

  it("does not hit the redemption ledger when no code was supplied", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const t = await resolveOrderTotals(fakeStripe(search), CART, "");
    expect(search).not.toHaveBeenCalled();
    expect(t.discountCents).toBe(0);
  });
});

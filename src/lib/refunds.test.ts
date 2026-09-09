import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { refundSummary } from "./orders";
import { parseAmountToCents } from "./money-input";

/**
 * Refund arithmetic, pinned because getting it wrong means either refusing a
 * refund a customer is owed or over-refunding a live charge.
 *
 * The reason these read the CHARGE and not the PaymentIntent: pi.amount is what
 * was intended, charge.amount_captured is what was actually taken, and this
 * checkout updates the intent's amount as the cart changes — so the two differ
 * routinely, not exceptionally.
 */

function charge(over: Partial<Stripe.Charge> = {}): Stripe.Charge {
  return {
    id: "ch_1",
    amount: 3638,
    amount_captured: 3638,
    amount_refunded: 0,
    disputed: false,
    ...over,
  } as unknown as Stripe.Charge;
}

describe("refundSummary", () => {
  it("reports nothing refunded on an untouched charge", () => {
    const s = refundSummary(charge());
    expect(s.state).toBe("none");
    expect(s.refundableCents).toBe(3638);
  });

  /**
   * The case that prompted all of this: $29.63 refunded in the Stripe Dashboard
   * showed nowhere in the portal, because toOrder never read amount_refunded.
   */
  it("sees a refund issued outside this app", () => {
    const s = refundSummary(charge({ amount_refunded: 2963 }));
    expect(s.state).toBe("partial");
    expect(s.amountRefundedCents).toBe(2963);
    expect(s.refundableCents).toBe(3638 - 2963);
  });

  it("calls it full only when nothing is left, not when a flag says so", () => {
    const s = refundSummary(charge({ amount_refunded: 3638 }));
    expect(s.state).toBe("full");
    expect(s.refundableCents).toBe(0);
  });

  /** An amount updated late in checkout leaves captured < intended. */
  it("computes the balance from amount_captured, not the intended amount", () => {
    const s = refundSummary(charge({ amount: 9999, amount_captured: 3638, amount_refunded: 1000 }));
    expect(s.refundableCents).toBe(2638);
  });

  it("never reports a negative balance", () => {
    const s = refundSummary(charge({ amount_captured: 1000, amount_refunded: 1500 }));
    expect(s.refundableCents).toBe(0);
    expect(s.state).toBe("full");
  });

  it("surfaces a dispute so the UI can refuse to refund into one", () => {
    expect(refundSummary(charge({ disputed: true })).disputed).toBe(true);
  });

  /**
   * A charge we could not resolve is not proof of "no refunds" — but zero is
   * the only honest answer available, and the refund action re-reads the charge
   * itself before moving money, so nothing depends on this being complete.
   */
  it("degrades to zeroes on a null charge instead of throwing", () => {
    const s = refundSummary(null);
    expect(s.state).toBe("none");
    expect(s.refundableCents).toBe(0);
  });
});

describe("parseAmountToCents", () => {
  /**
   * This is the confirmation an operator types before real money moves, so
   * anything ambiguous has to be refused rather than guessed at. Number("")
   * is 0, which would silently confirm a zero-dollar refund.
   */
  it("accepts clean amounts, with or without decoration", () => {
    expect(parseAmountToCents("29.63")).toBe(2963);
    expect(parseAmountToCents("$29.63")).toBe(2963);
    expect(parseAmountToCents(" 1,234.50 ")).toBe(123450);
    expect(parseAmountToCents("29.6")).toBe(2960);
    expect(parseAmountToCents("29")).toBe(2900);
  });

  it("refuses anything it would have to guess about", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("   ")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("29.634")).toBeNull();
    expect(parseAmountToCents("-29.63")).toBeNull();
    expect(parseAmountToCents("1e2")).toBeNull();
    expect(parseAmountToCents("29.63.1")).toBeNull();
  });

  /** Float multiplication would make this 2962. */
  it("does not lose a cent to floating point", () => {
    expect(parseAmountToCents("29.63")).toBe(2963);
    expect(parseAmountToCents("0.29")).toBe(29);
    expect(parseAmountToCents("1.15")).toBe(115);
  });
});

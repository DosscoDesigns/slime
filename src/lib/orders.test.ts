import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { toOrder } from "./orders";

function pi(metadata: Record<string, string> = {}) {
  return {
    id: "pi_1",
    created: 1_757_000_000,
    amount: 3638,
    metadata: {
      items: JSON.stringify([{ n: "Block Party — 40G (green)", q: 1, c: 3799 }]),
      subtotal_cents: "3799",
      discount_cents: "760",
      shipping_cents: "599",
      tax_cents: "0",
      coupon_code: "SLIMECO20OFF",
      ...metadata,
    },
  } as unknown as Stripe.PaymentIntent;
}

const charge = {
  receipt_url: "https://pay.stripe.com/receipts/x",
  shipping: {
    name: "Britaini Evanuik",
    address: { line1: "111 Highview Avenue", city: "Pittsburgh", state: "PA", postal_code: "15238", country: "US" },
  },
  billing_details: { email: "buyer@example.com", phone: null, name: "Britaini Evanuik" },
} as unknown as Stripe.Charge;

describe("toOrder", () => {
  it("reads the money fields off metadata", () => {
    const o = toOrder(pi(), charge);
    expect(o.subtotalCents).toBe(3799);
    expect(o.discountCents).toBe(760);
    expect(o.amountCents).toBe(3638);
    expect(o.couponCode).toBe("SLIMECO20OFF");
  });

  it("reads the ship-to off the charge", () => {
    expect(toOrder(pi(), charge).shipTo?.city).toBe("Pittsburgh");
  });

  it("survives a charge that never resolved", () => {
    const o = toOrder(pi(), null);
    expect(o.customerName).toBeNull();
    expect(o.shipTo).toBeNull();
    expect(o.lines).toHaveLength(1);
  });

  it("survives unparseable items metadata", () => {
    expect(toOrder(pi({ items: "{not json" }), charge).lines).toEqual([]);
  });
});

/**
 * The middle state is the point. A label can be bought and printed while the
 * customer has not been told — collapsing that into "shipped" would hide
 * exactly the orders most likely to be forgotten halfway.
 */
describe("fulfilment state", () => {
  it("is unfulfilled with no tracking", () => {
    expect(toOrder(pi(), charge).state).toBe("unfulfilled");
  });

  it("is label_bought once tracking exists but no email went out", () => {
    expect(toOrder(pi({ tracking_number: "9334" }), charge).state).toBe("label_bought");
  });

  it("is shipped once the customer has been emailed", () => {
    const o = toOrder(
      pi({ tracking_number: "9334", shipping_email_sent_at: "2026-09-08T22:55:57.360Z" }),
      charge
    );
    expect(o.state).toBe("shipped");
    expect(o.shippingEmailSentAt).toBeInstanceOf(Date);
  });

  // An emailed order with no tracking shouldn't read as unfulfilled — the
  // customer has already been told something shipped.
  it("treats an emailed order as shipped even without tracking", () => {
    expect(toOrder(pi({ shipping_email_sent_at: "2026-09-08T00:00:00Z" }), charge).state).toBe("shipped");
  });

  it("reports postage cost only when known", () => {
    expect(toOrder(pi(), charge).shippingCostCents).toBeNull();
    expect(toOrder(pi({ shipping_cost_cents: "699" }), charge).shippingCostCents).toBe(699);
  });
});

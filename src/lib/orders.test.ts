import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { toOrder, rowStatus, deriveState } from "./orders";

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

/**
 * The state model, pinned because it is the thing that decides what shows up in
 * the default list — and an order that silently stops appearing is an order
 * that never gets shipped.
 */
describe("state, cancellation and attention", () => {
  const tracked = (md: Record<string, string>) =>
    toOrder(pi({ tracking_number: "9205590164917312751089", ...md }), charge);

  it("reports carrier truth over our own bookkeeping once the parcel moves", () => {
    expect(tracked({ trk_status: "transit" }).state).toBe("in_transit");
    expect(tracked({ trk_status: "delivered" }).state).toBe("delivered");
    // Not successes — these are exactly the orders that need a human.
    expect(tracked({ trk_status: "returned" }).state).toBe("returned");
    expect(tracked({ trk_status: "failure" }).state).toBe("failed");
  });

  it("keeps the label-bought-but-not-emailed state that fulfilment depends on", () => {
    expect(tracked({}).state).toBe("label_bought");
    expect(tracked({ shipping_email_sent_at: "2026-09-09T00:00:00Z" }).state).toBe("shipped");
    expect(toOrder(pi(), charge).state).toBe("unfulfilled");
  });

  /**
   * The reason needsAttention is its own field rather than a state: a delivered
   * parcel whose customer was never told is finished logistically and
   * unfinished operationally. Keying the filter off `state` would hide it.
   */
  it("still flags a delivered order whose customer was never emailed", () => {
    const o = tracked({ trk_status: "delivered" });
    expect(o.state).toBe("delivered");
    expect(o.needsAttention).toBe(true);
  });

  it("stops asking for attention once delivered AND emailed", () => {
    const o = tracked({ trk_status: "delivered", shipping_email_sent_at: "2026-09-12T00:00:00Z" });
    expect(o.needsAttention).toBe(false);
  });

  it("drops a cancelled order out of the work list without losing why", () => {
    const o = tracked({ cancelled_at: "2026-09-09T10:00:00Z", cancelled_reason: "duplicate order" });
    expect(o.cancelledAt?.toISOString()).toBe("2026-09-09T10:00:00.000Z");
    expect(o.cancelledReason).toBe("duplicate order");
    expect(o.needsAttention).toBe(false);
    expect(rowStatus(o)).toBe("cancelled");
  });

  it("stops asking for attention on a fully refunded order", () => {
    const refunded = { ...charge, amount_captured: 3638, amount_refunded: 3638 } as typeof charge;
    const o = toOrder(pi({ tracking_number: "9205590164917312751089" }), refunded);
    expect(o.needsAttention).toBe(false);
    expect(rowStatus(o)).toBe("refunded");
  });

  /** Cancellation is an operator decision; it outranks Stripe's ledger. */
  it("shows cancelled ahead of refunded when an order is both", () => {
    const refunded = { ...charge, amount_captured: 3638, amount_refunded: 3638 } as typeof charge;
    const o = toOrder(pi({ cancelled_at: "2026-09-09T10:00:00Z" }), refunded);
    expect(rowStatus(o)).toBe("cancelled");
  });
});

describe("tracking read off metadata", () => {
  it("prefers the carrier and link recorded at purchase over guessing", () => {
    const o = toOrder(
      pi({
        tracking_number: "1Z999AA10123456784",
        tracking_carrier: "ups",
        tracking_url: "https://shippo.example/track/1Z999AA10123456784",
      }),
      charge
    );
    expect(o.tracking?.carrier).toBe("ups");
    expect(o.tracking?.url).toBe("https://shippo.example/track/1Z999AA10123456784");
  });

  it("falls back to the shape guess for labels bought before we recorded it", () => {
    const o = toOrder(pi({ tracking_number: "1Z999AA10123456784" }), charge);
    expect(o.tracking?.carrier).toBe("ups");
    expect(o.tracking?.url).toContain("ups.com");
  });

  it("ignores a status string that is not one Shippo actually sends", () => {
    const o = toOrder(pi({ tracking_number: "9205590164917312751089", trk_status: "haunted" }), charge);
    expect(o.tracking?.status).toBeNull();
    expect(o.state).toBe("label_bought");
  });

  it("has no tracking at all before a label is bought", () => {
    expect(toOrder(pi(), charge).tracking).toBeNull();
  });
});

describe("deriveState", () => {
  it("is a pure function of metadata and tracking", () => {
    expect(deriveState({}, null)).toBe("unfulfilled");
    expect(deriveState({ tracking_number: "x" }, null)).toBe("label_bought");
  });
});

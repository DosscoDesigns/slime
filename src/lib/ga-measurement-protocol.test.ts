import { describe, it, expect } from "vitest";
import { buildPurchaseBody } from "./ga-measurement-protocol";

const base = {
  transactionId: "pi_3ABC",
  valueCents: 4457,
  taxCents: 285,
  shippingCents: 599,
  couponCode: "SLIMECO20OFF",
  items: [
    {
      item_id: "SLIME-KIT-40G",
      item_name: "40 Gallon Slime Powder Kit",
      item_brand: "The Slime Co",
      item_category: "Slime Powder Kits",
      price: 37.99,
      quantity: 1,
    },
  ],
  clientId: "1234567890.1234567890",
  sessionId: "1757000000",
};

describe("buildPurchaseBody", () => {
  it("sends engagement_time_msec and session_id", () => {
    // Footgun 2 in the module header: without BOTH of these the event reaches
    // Realtime/DebugView and never lands in a standard report. This is the
    // single most common reason a Measurement Protocol setup 'does nothing'.
    const params = buildPurchaseBody(base).events[0].params;
    expect(params.engagement_time_msec).toBe(1);
    expect(params.session_id).toBe("1757000000");
  });

  it("converts cents to units", () => {
    const params = buildPurchaseBody(base).events[0].params;
    expect(params.value).toBe(44.57);
    expect(params.tax).toBe(2.85);
    expect(params.shipping).toBe(5.99);
    expect(params.currency).toBe("USD");
  });

  it("uses the PaymentIntent id as transaction_id", () => {
    // GA4 deduplicates purchases on transaction_id, so this is what protects
    // revenue if the event is ever sent twice.
    expect(buildPurchaseBody(base).events[0].params.transaction_id).toBe("pi_3ABC");
  });

  it("falls back to a synthetic client_id when the _ga cookie was blocked", () => {
    // Revenue still counts; attribution degrades to (direct). Losing the sale
    // entirely would be the worse trade.
    const body = buildPurchaseBody({ ...base, clientId: null });
    expect(body.client_id).toBe("stripe.pi_3ABC");
  });

  it("keeps the real client_id when it is present", () => {
    expect(buildPurchaseBody(base).client_id).toBe("1234567890.1234567890");
  });

  it("omits session_id entirely rather than sending an empty one", () => {
    const params = buildPurchaseBody({ ...base, sessionId: null }).events[0].params;
    expect("session_id" in params).toBe(false);
  });

  it("omits coupon when no code was used", () => {
    const params = buildPurchaseBody({ ...base, couponCode: null }).events[0].params;
    expect("coupon" in params).toBe(false);
  });

  it("does not send order data for ad personalization", () => {
    expect(buildPurchaseBody(base).non_personalized_ads).toBe(true);
  });

  it("names the event exactly 'purchase'", () => {
    // GA4 only treats the reserved name as an e-commerce conversion; a typo
    // produces a custom event that silently reports no revenue.
    expect(buildPurchaseBody(base).events[0].name).toBe("purchase");
  });
});

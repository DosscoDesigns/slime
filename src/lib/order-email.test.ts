import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { renderCustomerReceipt, renderOpsNotice } from "./order-email";
import { CONTACT_EMAIL } from "./site";

/**
 * The two order emails exist because a single BCC'd message gave every
 * recipient the same Message-ID (mail clients dedupe it) AND handed the buyer
 * a fulfillment ticket written for the shop. These pin the split so a later
 * "why are we rendering this twice?" cleanup can't silently undo it.
 */

const CUSTOMER_EMAIL = "buyer@example.com";
const CUSTOMER_PHONE = "+15551234567";

function fixture(overrides: Partial<Stripe.PaymentIntent> = {}) {
  const pi = {
    id: "pi_test_123",
    amount: 2963,
    metadata: {
      items: JSON.stringify([{ n: "Backyard Bash — 20G (green)", q: 1, c: 2199 }]),
      subtotal_cents: "2199",
      discount_cents: "0",
      shipping_cents: "599",
      tax_cents: "165",
    },
    ...overrides,
  } as unknown as Stripe.PaymentIntent;

  const charge = {
    receipt_url: "https://pay.stripe.com/receipts/abc",
    billing_details: {
      name: "Jason Doss",
      email: CUSTOMER_EMAIL,
      phone: CUSTOMER_PHONE,
      address: {
        line1: "1 Main St",
        city: "Tampa",
        state: "FL",
        postal_code: "33601",
        country: "US",
      },
    },
    shipping: null,
  } as unknown as Stripe.Charge;

  return { pi, charge };
}

describe("the two emails are distinguishable", () => {
  it("gives them different subjects, so an inbox can tell them apart", () => {
    const { pi, charge } = fixture();
    const ops = renderOpsNotice({ pi, charge });
    const cust = renderCustomerReceipt({ pi, charge });
    expect(ops.subject).not.toBe(cust.subject);
    expect(cust.subject).toMatch(/your slime co order/i);
    expect(ops.subject).toMatch(/new order/i);
  });

  it("puts the money in both, identically", () => {
    const { pi, charge } = fixture();
    for (const m of [renderOpsNotice({ pi, charge }), renderCustomerReceipt({ pi, charge })]) {
      expect(m.text).toContain("$29.63");
      expect(m.text).toContain("$21.99");
      expect(m.text).toContain("$5.99");
      expect(m.text).toContain("$1.65");
    }
  });
});

describe("customer receipt", () => {
  /**
   * The original bug in miniature: the buyer was sent a block reciting their
   * own name, email and phone back at them, which reads as an internal record.
   */
  it("does not recite the buyer's own contact details back at them", () => {
    const { pi, charge } = fixture();
    const { text, html } = renderCustomerReceipt({ pi, charge });
    expect(text).not.toContain(CUSTOMER_EMAIL);
    expect(html).not.toContain(CUSTOMER_EMAIL);
    expect(text).not.toContain(CUSTOMER_PHONE);
    expect(html).not.toContain(CUSTOMER_PHONE);
    expect(text).not.toMatch(/^CUSTOMER$/m);
  });

  it("gives them a real address to reply to", () => {
    const { pi, charge } = fixture();
    const { text, html } = renderCustomerReceipt({ pi, charge });
    expect(text).toContain(CONTACT_EMAIL);
    expect(html).toContain(CONTACT_EMAIL);
  });

  it("is the transaction record, so it carries the order reference and receipt", () => {
    const { pi, charge } = fixture();
    const { text } = renderCustomerReceipt({ pi, charge });
    expect(text).toContain("pi_test_123");
    expect(text).toContain("https://pay.stripe.com/receipts/abc");
  });

  it("still ships an address block and a thank-you", () => {
    const { pi, charge } = fixture();
    const { text } = renderCustomerReceipt({ pi, charge });
    expect(text).toContain("1 Main St");
    expect(text).toMatch(/thanks, jason/i);
  });

  it("shows a discount when one was applied", () => {
    const { pi, charge } = fixture();
    pi.metadata.discount_cents = "440";
    pi.metadata.coupon_code = "SLIMECO20OFF";
    const { text } = renderCustomerReceipt({ pi, charge });
    expect(text).toContain("SLIMECO20OFF");
    expect(text).toContain("-$4.40");
  });

  it("degrades gracefully when Stripe gave us no charge", () => {
    const { pi } = fixture();
    const { subject, text } = renderCustomerReceipt({ pi, charge: null });
    expect(subject).toContain("$29.63");
    expect(text).toContain("pi_test_123");
  });
});

describe("ops notice", () => {
  /** The shop still needs the buyer's contact details to fulfil the order. */
  it("keeps the customer contact block", () => {
    const { pi, charge } = fixture();
    const { text } = renderOpsNotice({ pi, charge });
    expect(text).toContain(CUSTOMER_EMAIL);
    expect(text).toContain(CUSTOMER_PHONE);
    expect(text).toContain("1 Main St");
  });
});

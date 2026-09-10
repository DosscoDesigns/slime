import PageShell from "@/components/PageShell";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/site";
import {
  SHIPPING_FLAT_CENTS,
  SHIPPING_FREE_THRESHOLD_CENTS,
  FL_TAX_RATE,
} from "@/lib/pricing";

/**
 * Shipping and returns, at a real URL.
 *
 * This page is not optional decoration. Google Merchant Center will not
 * approve product listings without a crawlable returns policy, and our Product
 * JSON-LD already asserts `merchantReturnDays: 30` and that a change-of-mind
 * return's shipping is the customer's responsibility —
 * an assertion with nothing behind it is exactly the kind of mismatch that
 * gets an account suspended rather than merely warned.
 *
 * Every number here is read from pricing.ts. Typing "$5.99" into the prose is
 * how the policy ends up contradicting the checkout after a price change.
 */

const LAST_UPDATED = "2026-09-09";

const usd = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export const metadata = pageMetadata({
  title: "Shipping & Returns",
  description:
    "How Slime Co orders ship: US delivery via USPS, processing and delivery times, flat-rate and free shipping thresholds, and our 30-day return policy.",
  path: "/shipping-returns",
});

export default function ShippingReturnsPage() {
  return (
    <PageShell
      title="Shipping & Returns"
      intro="Where we ship, how long it takes, what it costs, and what happens if something arrives wrong."
      updated={LAST_UPDATED}
    >
      <h2>Shipping</h2>

      <h3>Where we ship</h3>
      <p>
        We ship to addresses within the <strong>United States only</strong>,
        including Alaska and Hawaii. We do not currently ship internationally or
        to PO boxes outside the USPS network. Orders ship from Florida.
      </p>

      <h3>Processing and delivery time</h3>
      <p>
        Orders are packed and handed to the carrier within{" "}
        <strong>1–3 business days</strong>. Once shipped, standard delivery
        typically takes <strong>5–7 business days</strong> depending on
        distance. Combined, most orders arrive within about a week and a half of
        being placed.
      </p>
      <p>
        Kits ship via <strong>USPS Ground Advantage</strong>. If you are
        ordering for a dated event, order at least two weeks ahead — and if you
        are closer than that, email us before you order and we will tell you
        honestly whether it will make it.
      </p>

      <h3>Shipping cost</h3>
      <ul>
        <li>
          Flat <strong>{usd(SHIPPING_FLAT_CENTS)}</strong> per order, no matter
          how many kits are on it.
        </li>
        <li>
          <strong>Free</strong> on orders of{" "}
          {usd(SHIPPING_FREE_THRESHOLD_CENTS)} or more, before any discount
          code is applied.
        </li>
        <li>
          Florida addresses are charged {(FL_TAX_RATE * 100).toFixed(1)}% sales
          tax on the order subtotal. Tax is not charged on shipping.
        </li>
      </ul>

      <h3>Tracking</h3>
      <p>
        You will get a confirmation email as soon as your order is placed, and a
        second email with a tracking number once the label is printed. If the
        tracking email has not arrived within three business days, check your
        spam folder first, then email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will find
        it.
      </p>

      <h2>Returns</h2>

      <h3>If your order is damaged or wrong</h3>
      <p>
        Contact us within <strong>14 days</strong> of delivery and we will make
        it right — a replacement or a full refund, your choice. We pay return
        shipping, and in most cases we will not ask you to send anything back at
        all. A photo is usually all we need.
      </p>

      <h3>If you changed your mind</h3>
      <p>
        Unopened kits in their original packaging can be returned within{" "}
        <strong>30 days</strong> of delivery for a full refund of the product
        price. Return shipping for a change-of-mind return is paid by the buyer,
        and the original shipping charge is not refunded.
      </p>

      <h3>What we cannot take back</h3>
      <p>
        <strong>Opened powder pouches cannot be returned.</strong> Once a pouch
        is opened we have no way to verify or resell its contents, so this one
        is firm. It is not a restocking-fee situation — we simply cannot accept
        it. If an opened kit did not perform the way you expected, email us
        anyway; that is a different conversation and we would rather have it.
      </p>

      <h3>How to start a return</h3>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your
        order number and what went wrong. There is no form and no portal — a
        person reads it. We will reply with return instructions or a refund
        confirmation.
      </p>

      <h3>Refund timing</h3>
      <p>
        Approved refunds are issued to the original payment method within{" "}
        <strong>3 business days</strong> of approval (or of us receiving a
        returned kit). Your bank may take a further 5–10 business days to post
        it, which is outside our control.
      </p>

      <h2>Questions</h2>
      <p>
        Anything not covered here, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We would rather
        answer a question before you order than process a return after.
      </p>
    </PageShell>
  );
}

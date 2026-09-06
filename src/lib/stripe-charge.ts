import type Stripe from "stripe";
import { logError, errorContext } from "@/lib/logger";

/**
 * Resolve the charge behind a PaymentIntent, whatever API version the webhook
 * endpoint is pinned to.
 *
 * Everything customer-facing in the order email — name, email, phone, ship-to
 * address, receipt link — comes off the charge, and the customer's BCC copy is
 * addressed from it too. So a null charge doesn't just degrade the email, it
 * means the customer gets nothing.
 *
 * `latest_charge` only exists from API version 2022-11-15 onward; older
 * versions (this endpoint is pinned to 2020-08-27) send an embedded
 * `charges.data[]` list instead. We try the modern field, then the legacy
 * shape, then fall back to querying by payment_intent — which works on every
 * version and also covers an event payload that carried neither.
 */
export async function resolveCharge(
  stripe: Stripe,
  pi: Stripe.PaymentIntent
): Promise<Stripe.Charge | null> {
  if (pi.latest_charge) {
    return typeof pi.latest_charge === "string"
      ? await stripe.charges.retrieve(pi.latest_charge)
      : pi.latest_charge;
  }

  // Pre-2022-11-15 payload shape, absent from the current SDK's types.
  const legacy = (pi as unknown as { charges?: { data?: Stripe.Charge[] } })
    .charges?.data?.[0];
  if (legacy) return legacy;

  try {
    const found = await stripe.charges.list({
      payment_intent: pi.id,
      limit: 1,
    });
    return found.data[0] ?? null;
  } catch (err) {
    logError("could not resolve charge", {
      payment_intent: pi.id,
      ...errorContext(err),
    });
    return null;
  }
}

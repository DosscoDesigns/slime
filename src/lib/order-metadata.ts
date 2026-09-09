/**
 * The one way to write PaymentIntent metadata.
 *
 * SERVER-ONLY.
 *
 * Stripe MERGES metadata on update — it does not replace it. Unlisted keys are
 * left alone, `""` unsets one key, and `null` for the whole map clears it. This
 * repo already relies on that: `ga_items` is written once at PaymentIntent
 * creation (src/app/api/checkout/route.ts), /api/checkout/update-amount then
 * writes nine keys without it, and the webhook still reads pi.metadata.ga_items
 * in production.
 *
 * So the `{ ...(await retrieve()).metadata, newKey }` pattern this file replaces
 * bought nothing and actively caused harm: it re-sent a SNAPSHOT of every other
 * key, so any write that landed between the retrieve and the update was silently
 * reverted. The worst case was emailCustomer(), which snapshotted metadata,
 * awaited a Mailgun send for seconds, then wrote the stale snapshot back — long
 * enough for an inbound Shippo tracking update to be lost.
 *
 * With this helper each key has exactly ONE writer and every writer sends only
 * its own keys, so concurrent writes to different keys cannot interfere. That is
 * the whole mitigation, and it is sufficient — there is no read-modify-write
 * left to race.
 *
 * Key ownership:
 *   checkout / update-amount   items, *_cents, coupon_code, ga_*, notification_email
 *   webhook (Stripe)           *_sent_at notification flags, ga_purchase_sent_at
 *   buyAndPrintLabel           tracking_number, tracking_carrier, tracking_url,
 *                              shipping_cost_cents, label_bought_at
 *   tracking refresh/webhook   trk_status, trk_status_at, trk_eta,
 *                              trk_transit_at, trk_delivered_at
 *   emailCustomer              shipping_email_sent_at
 *   cancelOrder                cancelled_at, cancelled_reason
 */
import type Stripe from "stripe";

/** Stripe's documented ceilings. Exceeding any one 400s the ENTIRE update. */
export const MAX_KEYS = 50;
export const MAX_KEY_LENGTH = 40;
export const MAX_VALUE_LENGTH = 500;

/**
 * Clamp a value to Stripe's limit.
 *
 * Truncating beats throwing for free-text fields: a cancellation reason that is
 * too long should not be able to prevent the cancellation from being recorded.
 */
export function clampValue(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;
}

/**
 * Validate a patch without sending it. Exported for tests.
 *
 * A key that is too long is a programming error rather than bad data, so it
 * throws — silently truncating a key would write to the wrong field.
 */
export function preparePatch(patch: Record<string, string>): Record<string, string> {
  const entries = Object.entries(patch);
  if (entries.length > MAX_KEYS) {
    throw new Error(`metadata patch has ${entries.length} keys, over Stripe's limit of ${MAX_KEYS}`);
  }
  const prepared: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.length > MAX_KEY_LENGTH) {
      throw new Error(`metadata key "${key}" is ${key.length} chars, over Stripe's limit of ${MAX_KEY_LENGTH}`);
    }
    prepared[key] = clampValue(value);
  }
  return prepared;
}

/**
 * Merge these keys into the PaymentIntent's metadata, leaving every other key
 * untouched. Never retrieve-then-spread; see the note at the top of this file.
 */
export async function patchOrderMetadata(
  stripe: Stripe,
  paymentIntentId: string,
  patch: Record<string, string>
): Promise<void> {
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: preparePatch(patch),
  });
}

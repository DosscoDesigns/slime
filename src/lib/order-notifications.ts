// Which order emails still owe sending, given a PaymentIntent's CURRENT
// metadata.
//
// Extracted from the webhook route so it can be tested directly: App Router
// route modules reject non-handler exports, and this is the logic that decides
// whether a customer gets a second copy of their receipt.
//
// The caller MUST pass freshly-retrieved metadata, not the metadata on the
// webhook event payload. That payload is a snapshot from before any flag was
// written, and Stripe replays it verbatim on retry — so a check against it can
// never observe its own flag.

import type Stripe from "stripe";

export interface PendingNotifications {
  ops: boolean;
  customer: boolean;
}

export function pendingNotifications(
  metadata: Stripe.Metadata | null | undefined
): PendingNotifications {
  // The legacy flag comes from when both parties shared one BCC'd email, so an
  // order bearing it has already been fully notified and counts for both.
  const legacyCombinedSent = Boolean(metadata?.order_email_sent_at);

  return {
    ops: !(legacyCombinedSent || Boolean(metadata?.ops_email_sent_at)),
    customer: !(legacyCombinedSent || Boolean(metadata?.customer_email_sent_at)),
  };
}

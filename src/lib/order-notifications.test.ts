import { describe, it, expect } from "vitest";
import { pendingNotifications } from "./order-notifications";

/**
 * These exist because the guard they replace never actually fired. The webhook
 * read `event.data.object.metadata` — a snapshot taken BEFORE the flag was
 * written — and Stripe replays that snapshot verbatim on every retry, so the
 * check could never observe its own flag. Verified in production 2026-09-06:
 * a replayed delivery re-sent both emails for an already-notified order.
 */

describe("pendingNotifications", () => {
  it("owes both on a fresh order", () => {
    expect(pendingNotifications({})).toEqual({ ops: true, customer: true });
    expect(pendingNotifications(null)).toEqual({ ops: true, customer: true });
    expect(pendingNotifications(undefined)).toEqual({ ops: true, customer: true });
  });

  it("owes nothing once both have sent", () => {
    expect(
      pendingNotifications({
        ops_email_sent_at: "2026-09-07T00:40:49Z",
        customer_email_sent_at: "2026-09-07T00:40:50Z",
      })
    ).toEqual({ ops: false, customer: false });
  });

  /**
   * The failure mode the split exists to prevent: one send fails, Stripe
   * retries, and the message that already went must NOT go again.
   */
  it("owes only the one that failed", () => {
    expect(pendingNotifications({ ops_email_sent_at: "x" })).toEqual({
      ops: false,
      customer: true,
    });
    expect(pendingNotifications({ customer_email_sent_at: "x" })).toEqual({
      ops: true,
      customer: false,
    });
  });

  /** Orders placed under the old BCC scheme are fully notified already. */
  it("treats the legacy combined flag as covering both", () => {
    expect(pendingNotifications({ order_email_sent_at: "2026-09-07T00:25:36Z" })).toEqual({
      ops: false,
      customer: false,
    });
  });

  it("ignores unrelated metadata", () => {
    expect(
      pendingNotifications({ coupon_code: "SLIMECO20OFF", subtotal_cents: "2199" })
    ).toEqual({ ops: true, customer: true });
  });
});

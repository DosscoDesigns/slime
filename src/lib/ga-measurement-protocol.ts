/**
 * Server-side GA4 `purchase`, sent from the Stripe webhook via the Measurement
 * Protocol.
 *
 * SERVER-ONLY. GA_API_SECRET carries no NEXT_PUBLIC_ prefix and must never
 * reach the bundle — anyone holding it can write arbitrary events into the
 * property.
 *
 * Why the purchase event lives here and not in the browser: see the comment on
 * trackPurchase() in analytics.ts. Short version — /success is missable, the
 * browser does not know the authoritative amount, and gtag.js is blockable.
 * The webhook is none of those things.
 *
 * The same three invariants as logger.ts hold: never throw, never hang, never
 * required. An analytics failure must not 500 a webhook, because a 500 makes
 * Stripe retry an order that was already emailed.
 *
 * ── Measurement Protocol footguns this module exists to get right ──────────
 *
 *  1. THE ENDPOINT ALWAYS RETURNS 204. A completely malformed payload is
 *     accepted silently and simply never appears in a report. There is no
 *     success signal to check, which is why GA_DEBUG_MP exists below.
 *     AND THE DEBUG ENDPOINT ONLY CHECKS THE PAYLOAD, NOT THE CREDENTIAL —
 *     verified 2026-09-09 by sending the same body with a deliberately bogus
 *     api_secret and getting the identical empty `validationMessages` back.
 *     So a green debug response means "this JSON is well-formed", never "these
 *     credentials work". The only way to prove the secret is to send a real
 *     event and look for it in GA4's Realtime report.
 *  2. `session_id` and `engagement_time_msec` are effectively REQUIRED. Omit
 *     them and the event lands in Realtime/DebugView but never in the standard
 *     reports — the single most common reason "MP doesn't work".
 *  3. Without a real `client_id` from the browser's `_ga` cookie the sale is
 *     a brand-new user attributed to (direct), so the revenue is right and the
 *     attribution is worthless. We stash the id at checkout for this reason.
 *  4. Events older than ~72 hours are dropped. A Stripe webhook retried for
 *     three days would silently vanish; nothing to do about it, but do not be
 *     surprised by it.
 */

import type Stripe from "stripe";
import { logError, logInfo, logWarn, errorContext } from "@/lib/logger";
import { decodeGa4Items, GA_CURRENCY, type Ga4Item } from "@/lib/ga-items";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const API_SECRET = process.env.GA_API_SECRET;

/**
 * Route through the validating endpoint, which DOES return a body describing
 * what is wrong with the PAYLOAD (not the credentials — see footgun 1). Set
 * GA_DEBUG_MP=1 temporarily when a change to this file needs proving; leave it
 * unset in production, because the debug endpoint validates without recording.
 */
const DEBUG = process.env.GA_DEBUG_MP === "1";

const ENDPOINT = DEBUG
  ? "https://www.google-analytics.com/debug/mp/collect"
  : "https://www.google-analytics.com/mp/collect";

/** Well under Stripe's webhook read timeout — see logger.ts for the reasoning. */
const SEND_TIMEOUT_MS = 2000;

/** Metadata key that makes this idempotent across Stripe's webhook retries. */
export const GA_PURCHASE_FLAG = "ga_purchase_sent_at";

export const measurementProtocolConfigured = Boolean(MEASUREMENT_ID && API_SECRET);

const money = (cents: number) => Math.round(cents) / 100;

export interface PurchasePayload {
  transactionId: string;
  valueCents: number;
  taxCents: number;
  shippingCents: number;
  couponCode?: string | null;
  items: Ga4Item[];
  clientId?: string | null;
  sessionId?: string | null;
}

/**
 * Build the request body. Split out from the send so it can be asserted on in
 * tests without touching the network.
 */
export function buildPurchaseBody(p: PurchasePayload) {
  return {
    // Falling back to the transaction id keeps the revenue correct when the
    // `_ga` cookie was blocked. It costs attribution — this shows up as a new
    // (direct) user — but losing the sale entirely would be worse.
    client_id: p.clientId || `stripe.${p.transactionId}`,
    // Google Signals off: this is first-party order data, not ad personalization.
    non_personalized_ads: true,
    events: [
      {
        name: "purchase",
        params: {
          // Footgun 2. Both of these, always.
          ...(p.sessionId ? { session_id: p.sessionId } : {}),
          engagement_time_msec: 1,

          transaction_id: p.transactionId,
          // GA4's convention for `value` on purchase is the grand total,
          // with tax and shipping ALSO broken out as their own params. The
          // sum of items therefore does not equal value, which is expected.
          value: money(p.valueCents),
          currency: GA_CURRENCY,
          tax: money(p.taxCents),
          shipping: money(p.shippingCents),
          ...(p.couponCode ? { coupon: p.couponCode } : {}),
          items: p.items,
        },
      },
    ],
  };
}

/**
 * Fire the purchase event. Resolves true only when the request was actually
 * accepted, so the caller can decide whether to set the idempotency flag.
 * Never rejects.
 */
export async function sendPurchase(p: PurchasePayload): Promise<boolean> {
  if (!measurementProtocolConfigured) return false;

  const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(
    MEASUREMENT_ID!
  )}&api_secret=${encodeURIComponent(API_SECRET!)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPurchaseBody(p)),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (DEBUG) {
      // The only way to see what GA4 thinks of the payload. validationMessages
      // is an empty array when the event is well-formed.
      logInfo("ga4 mp debug response", {
        status: res.status,
        body: (await res.text()).slice(0, 1000),
        transaction_id: p.transactionId,
      });
      // The debug endpoint validates without recording, so nothing was
      // counted — do not let the caller flag this as sent.
      return false;
    }

    // Footgun 1: 204 means "received", not "valid". This only catches
    // transport-level problems (bad secret, wrong measurement id, outage).
    if (res.status !== 204 && !res.ok) {
      logWarn("ga4 measurement protocol rejected the purchase", {
        status: res.status,
        transaction_id: p.transactionId,
      });
      return false;
    }
    return true;
  } catch (err) {
    logError("ga4 purchase send failed", {
      transaction_id: p.transactionId,
      ...errorContext(err),
    });
    return false;
  }
}

/**
 * Send the purchase for a succeeded PaymentIntent, reading everything it needs
 * out of the PI and its metadata.
 *
 * Returns true when the event was accepted, so the webhook can persist the
 * idempotency flag in the same metadata write it already does for the emails.
 */
export async function sendPurchaseForPaymentIntent(
  pi: Stripe.PaymentIntent
): Promise<boolean> {
  if (!measurementProtocolConfigured) return false;
  if (pi.metadata?.[GA_PURCHASE_FLAG]) return false; // already counted

  return sendPurchase({
    transactionId: pi.id,
    valueCents: pi.amount,
    taxCents: Number(pi.metadata?.tax_cents ?? 0) || 0,
    shippingCents: Number(pi.metadata?.shipping_cents ?? 0) || 0,
    couponCode: pi.metadata?.coupon_code || null,
    items: decodeGa4Items(pi.metadata?.ga_items),
    clientId: pi.metadata?.ga_client_id || null,
    sessionId: pi.metadata?.ga_session_id || null,
  });
}

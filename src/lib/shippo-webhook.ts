/**
 * The Shippo tracking webhook's actual logic, kept out of the route so it can
 * be tested against a plain Stripe fake like everything else in src/lib.
 *
 * THE PAYLOAD IS NEVER TRUSTED. Shippo's only self-serve webhook authentication
 * is a secret token in the URL — HMAC exists but requires an account manager
 * and up to ten business days — and a token in a query string is a weak secret
 * that will sit in request logs.
 *
 * So the payload is treated as a TRIGGER, not as data: we read only the
 * tracking number and carrier from it, then re-fetch authoritative state from
 * Shippo with our own API key. The worst a forged request can achieve is making
 * us look up a tracking number we already own. This is the same reasoning the
 * Stripe webhook already applies to event.data.object, applied to a second
 * vendor.
 */
import type Stripe from "stripe";
import { patchOrderMetadata } from "@/lib/order-metadata";
import { fetchTrack, isValidTrackingNumber, type TrackingSnapshot } from "@/lib/tracking";
import { isCarrier, type Carrier } from "@/lib/carriers";
import { logError, logInfo, logWarn, errorContext } from "@/lib/logger";

/** A PaymentIntent id, as stamped on the Shippo transaction at label purchase. */
const ORDER_REF_RE = /^pi_[A-Za-z0-9]{8,64}$/;

export interface TrackTrigger {
  carrier: Carrier | "shippo";
  trackingNumber: string;
}

/**
 * Pull the two fields we act on out of an untrusted body.
 *
 * Shippo posts either the Track object directly or wraps it in `{event, data}`
 * depending on how the webhook was configured, so accept both shapes rather
 * than depending on dashboard settings we cannot see from here.
 */
export function readTrigger(body: unknown): TrackTrigger | null {
  if (!body || typeof body !== "object") return null;
  const outer = body as Record<string, unknown>;
  const track = (
    outer.data && typeof outer.data === "object" ? outer.data : outer
  ) as Record<string, unknown>;

  const trackingNumber = typeof track.tracking_number === "string" ? track.tracking_number : "";
  if (!isValidTrackingNumber(trackingNumber)) return null;

  const rawCarrier = typeof track.carrier === "string" ? track.carrier.toLowerCase() : "";
  // "shippo" is the carrier token the test-mode magic numbers use.
  const carrier: Carrier | "shippo" = isCarrier(rawCarrier)
    ? rawCarrier
    : rawCarrier === "shippo"
      ? "shippo"
      : "usps";

  return { carrier, trackingNumber };
}

/**
 * Find the order a tracking number belongs to.
 *
 * Preferred path is the reference we stamped on the Shippo transaction at
 * purchase, which comes back on the Track object — no lookup, no ambiguity.
 *
 * The fallback is a Stripe search, and it is a fallback for two reasons: the
 * search index is eventually consistent (documented as up to a minute behind,
 * and a PRE_TRANSIT event can fire seconds after purchase), and the value is
 * interpolated into a query string. Hence the hard validation on both sides
 * before either value goes anywhere near Stripe.
 */
export async function resolveOrderId(
  stripe: Stripe,
  snapshot: TrackingSnapshot,
  trackingNumber: string
): Promise<string | null> {
  if (snapshot.orderRef && ORDER_REF_RE.test(snapshot.orderRef)) {
    return snapshot.orderRef;
  }
  if (!isValidTrackingNumber(trackingNumber)) return null;

  try {
    const res = await stripe.paymentIntents.search({
      query: `status:'succeeded' AND metadata['tracking_number']:'${trackingNumber}'`,
      limit: 1,
    });
    return res.data[0]?.id ?? null;
  } catch (err) {
    logWarn("tracking webhook could not search for the order", {
      tracking: trackingNumber,
      ...errorContext(err),
    });
    return null;
  }
}

export interface HandleResult {
  handled: boolean;
  reason: string;
}

/**
 * Re-fetch and cache. Bounded to one Shippo GET and one Stripe write, plus at
 * most one Stripe search, so a burst of events cannot fan out.
 */
export async function handleTrackUpdate(
  stripe: Stripe,
  body: unknown
): Promise<HandleResult> {
  const trigger = readTrigger(body);
  if (!trigger) return { handled: false, reason: "no usable tracking number in payload" };

  let snapshot: TrackingSnapshot;
  try {
    snapshot = await fetchTrack(trigger.carrier, trigger.trackingNumber);
  } catch (err) {
    logWarn("tracking webhook could not re-fetch from Shippo", {
      tracking: trigger.trackingNumber,
      ...errorContext(err),
    });
    return { handled: false, reason: "could not re-fetch" };
  }

  const orderId = await resolveOrderId(stripe, snapshot, trigger.trackingNumber);
  if (!orderId) {
    // Not an error: Shippo will happily send events for numbers this deploy
    // knows nothing about (another environment, a test label, a stale
    // registration).
    return { handled: false, reason: "no matching order" };
  }

  try {
    await patchOrderMetadata(stripe, orderId, {
      trk_status: snapshot.status,
      trk_status_at: snapshot.statusAt?.toISOString() ?? "",
      trk_eta: snapshot.etaAt?.toISOString() ?? "",
      trk_transit_at: snapshot.transitStartedAt?.toISOString() ?? "",
      trk_delivered_at: snapshot.deliveredAt?.toISOString() ?? "",
    });
  } catch (err) {
    logError("tracking webhook could not record the update", {
      orderId,
      tracking: trigger.trackingNumber,
      ...errorContext(err),
    });
    return { handled: false, reason: "could not record" };
  }

  logInfo("tracking updated", {
    orderId,
    tracking: trigger.trackingNumber,
    status: snapshot.status,
  });
  return { handled: true, reason: snapshot.status };
}

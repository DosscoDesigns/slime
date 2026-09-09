/**
 * Shippo tracking — where the package actually is.
 *
 * SERVER-ONLY (it uses the Shippo key). Cost: NOTHING for our packages. Shippo
 * bills $0.02 per unique tracking number *created outside* Shippo; numbers from
 * labels we bought there are included, and the charge is per tracking number
 * rather than per call, so re-polling one is free however often we do it.
 *
 * The shape below was taken from Shippo's OpenAPI spec rather than guessed:
 * `tracking_status` is the latest event, `tracking_history` is every event with
 * the EARLIEST FIRST, and `status` is one of exactly six values.
 */
import type { Carrier } from "@/lib/carriers";
import { shippoGet, shippoPostFast } from "@/lib/shipping";

export type TrackingStatus =
  | "unknown"
  | "pre_transit"
  | "transit"
  | "delivered"
  | "returned"
  | "failure";

const STATUSES: readonly TrackingStatus[] = [
  "unknown",
  "pre_transit",
  "transit",
  "delivered",
  "returned",
  "failure",
];

/**
 * Once a package reaches one of these, stop calling Shippo for it — ever.
 *
 * RETURNED and FAILURE are terminal in the same sense DELIVERED is: the package
 * has stopped moving and nothing further will arrive. They are emphatically NOT
 * successes, which is why they get their own display state instead of being
 * folded into "done" — they are the two outcomes that need a human.
 */
export const TERMINAL_STATUSES: ReadonlySet<TrackingStatus> = new Set([
  "delivered",
  "returned",
  "failure",
]);

export function isTerminal(status: TrackingStatus | null): boolean {
  return status !== null && TERMINAL_STATUSES.has(status);
}

export function isTrackingStatus(v: unknown): v is TrackingStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export interface TrackingSnapshot {
  status: TrackingStatus;
  statusDetail: string | null;
  /** Shippo's status_date — when the CARRIER scanned it, not when we asked. */
  statusAt: Date | null;
  etaAt: Date | null;
  /**
   * The first `transit` scan: the carrier physically has the parcel.
   *
   * Deliberately NOT the first `pre_transit` event. USPS emits "Shipping Label
   * Created" as pre_transit dated at label creation, so measuring from it would
   * quietly turn carrier transit time into total time and make USPS look
   * responsible for our own handling delay.
   */
  transitStartedAt: Date | null;
  deliveredAt: Date | null;
  /** Whatever we stamped on the Shippo transaction — the PaymentIntent id. */
  orderRef: string | null;
}

/** Shippo's Track object, only the parts we read. */
interface RawTrackEvent {
  status?: string;
  status_details?: string;
  status_date?: string;
}

interface RawTrack {
  carrier?: string;
  tracking_number?: string;
  eta?: string;
  metadata?: string;
  tracking_status?: RawTrackEvent | null;
  tracking_history?: RawTrackEvent[] | null;
}

/** Shippo sends ISO strings; a malformed one must not poison the whole read. */
function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function eventStatus(e: RawTrackEvent | null | undefined): TrackingStatus | null {
  const raw = e?.status?.toLowerCase();
  return isTrackingStatus(raw) ? raw : null;
}

/**
 * Map a raw Track into our shape. PURE — no network, no env, unit-tested off
 * fixtures.
 *
 * `tracking_history` is documented as earliest-first, but this does not lean on
 * that: it scans for the first `transit` and the last `delivered` explicitly, so
 * a carrier returning events in another order still yields the right answer.
 */
export function parseTrack(json: unknown): TrackingSnapshot {
  const raw = (json ?? {}) as RawTrack;
  const history = Array.isArray(raw.tracking_history) ? raw.tracking_history : [];

  const latest = eventStatus(raw.tracking_status);

  let transitStartedAt: Date | null = null;
  let deliveredAt: Date | null = null;
  for (const event of history) {
    const status = eventStatus(event);
    const at = parseDate(event.status_date);
    if (!at) continue;
    if (status === "transit" && (!transitStartedAt || at < transitStartedAt)) {
      transitStartedAt = at;
    }
    if (status === "delivered" && (!deliveredAt || at > deliveredAt)) {
      deliveredAt = at;
    }
  }

  // A package can read DELIVERED on the latest status while the history that
  // carried the delivery scan has aged out. Fall back to the status date rather
  // than reporting a delivered package with no delivery time.
  if (!deliveredAt && latest === "delivered") {
    deliveredAt = parseDate(raw.tracking_status?.status_date);
  }

  return {
    status: latest ?? "unknown",
    statusDetail: raw.tracking_status?.status_details?.trim() || null,
    statusAt: parseDate(raw.tracking_status?.status_date),
    etaAt: parseDate(raw.eta),
    transitStartedAt,
    deliveredAt,
    orderRef: raw.metadata?.trim() || null,
  };
}

/**
 * Shippo rejects anything unexpected here anyway, but these values are
 * interpolated into a URL path — validate before they get there rather than
 * after.
 */
const TRACKING_NUMBER_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function isValidTrackingNumber(v: string): boolean {
  return TRACKING_NUMBER_RE.test(v);
}

/**
 * Live status for one package.
 *
 * With a `shippo_test_` key ONLY the magic numbers track — carrier `shippo`
 * with SHIPPO_PRE_TRANSIT / SHIPPO_TRANSIT / SHIPPO_DELIVERED / SHIPPO_RETURNED
 * / SHIPPO_FAILURE. A label bought with a test key returns a real-looking
 * tracking number that will never move, so testing against one and concluding
 * the integration is broken is the expected wrong turn.
 */
export async function fetchTrack(
  carrier: Carrier | "shippo",
  trackingNumber: string
): Promise<TrackingSnapshot> {
  if (!isValidTrackingNumber(trackingNumber)) {
    throw new Error(`refusing to track a malformed tracking number: ${trackingNumber}`);
  }
  const raw = await shippoGet<unknown>(
    `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`
  );
  return parseTrack(raw);
}

/**
 * Subscribe a tracking number to the tracking webhook, tagging it with the
 * order id.
 *
 * Labels bought through Shippo already push events to a registered webhook
 * without this, so it is NOT what makes the webhook work — the design must not
 * depend on it. It is called because it is the documented way to attach
 * `metadata`, which is what lets an inbound event identify its own order
 * without a lookup.
 *
 * Best-effort by definition: failing to register must never fail a label
 * purchase that already succeeded.
 */
export async function registerTracking(
  carrier: Carrier | "shippo",
  trackingNumber: string,
  orderRef: string
): Promise<void> {
  await shippoPostFast("/tracks/", {
    carrier,
    tracking_number: trackingNumber,
    metadata: orderRef.slice(0, 100),
  });
}

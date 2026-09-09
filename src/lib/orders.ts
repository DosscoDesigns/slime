/**
 * Orders, read from Stripe.
 *
 * SERVER-ONLY. There is no orders table yet: a succeeded PaymentIntent IS the
 * order, and fulfilment state lives in its metadata. That is the same choice
 * coupon-redemption.ts makes for the same reason — Stripe cannot drift from
 * what was actually charged, and a second store could.
 *
 * The limit of it: metadata is a flat string map with no history, so this can
 * say an order shipped but not who shipped it or how many attempts it took.
 * When the Supabase project takes over, THAT is the reason — not the reading.
 *
 * REFUNDS ARE NEVER CACHED HERE. They are read off the charge on every render,
 * so a refund issued in the Stripe Dashboard shows up on the next page load
 * with no webhook and no sync. Keeping a copy in metadata is exactly how a
 * $29.63 dashboard refund stayed invisible in this portal for weeks.
 */
import type Stripe from "stripe";
import { resolveCharge } from "@/lib/stripe-charge";
import { detectCarrier, isCarrier, trackUrl, type Carrier } from "@/lib/carriers";
import { isTrackingStatus, type TrackingStatus } from "@/lib/tracking";

export interface OrderLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * Fulfilment progress ONLY.
 *
 * Refund state and cancellation are deliberately not in this union. They are
 * orthogonal facts: an order can be delivered *and* refunded, or cancelled with
 * a label already printed. Folding them in would make "delivered and refunded"
 * unrepresentable exactly when someone needs to see it.
 */
export type FulfillmentState =
  | "unfulfilled"
  | "label_bought"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed";

export type RefundState = "none" | "partial" | "full";

/** Derived live from the charge every render. Never persisted. */
export interface RefundSummary {
  state: RefundState;
  amountRefundedCents: number;
  /**
   * What can still be refunded.
   *
   * Off the CHARGE, never the PaymentIntent: `pi.amount` is what was intended,
   * `charge.amount_captured` is what was actually taken, and they differ
   * whenever an amount was updated late in checkout.
   */
  refundableCents: number;
  disputed: boolean;
}

export interface OrderTracking {
  number: string;
  carrier: Carrier;
  /** Shippo's own link when we captured it, else built from the carrier table. */
  url: string;
  status: TrackingStatus | null;
  statusAt: Date | null;
  etaAt: Date | null;
  transitStartedAt: Date | null;
  deliveredAt: Date | null;
}

export interface Order {
  id: string;
  createdAt: Date;
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  couponCode: string | null;
  lines: OrderLine[];
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shipTo: Stripe.Address | null;
  receiptUrl: string | null;

  /** Refunds are issued against the charge, so the id has to travel with it. */
  chargeId: string | null;

  /** What the postage actually cost us, when known. */
  shippingCostCents: number | null;
  labelBoughtAt: Date | null;
  /** Set once the customer has been told it shipped. */
  shippingEmailSentAt: Date | null;

  tracking: OrderTracking | null;
  refund: RefundSummary;
  cancelledAt: Date | null;
  cancelledReason: string | null;

  state: FulfillmentState;
  /**
   * Whether this order is still work.
   *
   * The list filter keys off THIS, not off `state`. A delivered order whose
   * customer was never emailed is finished logistically and unfinished
   * operationally; filtering on `state` alone would hide it forever.
   */
  needsAttention: boolean;
}

function parseLines(metadata: Stripe.Metadata | null): OrderLine[] {
  try {
    const parsed = JSON.parse(metadata?.items || "[]") as Array<{
      n: string;
      q: number;
      c: number;
    }>;
    return Array.isArray(parsed)
      ? parsed.map((l) => ({ name: l.n, quantity: l.q, unitPriceCents: l.c }))
      : [];
  } catch {
    return [];
  }
}

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function date(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fulfilment state, derived rather than stored.
 *
 * The original three states existed because the middle one is real and matters:
 * a label can be bought and printed while the customer has not been told, and
 * collapsing that into "shipped" hides the orders most likely to be forgotten.
 * Live tracking adds four more that are equally real — in particular `returned`
 * and `failed`, which look like nothing at all if you only track "did we send
 * it".
 *
 * Carrier truth outranks our own bookkeeping: once the parcel is moving, where
 * it actually is says more than whether we remembered to send an email. The
 * email gap is not lost, it is carried by `needsAttention`.
 */
export function deriveState(
  md: Stripe.Metadata,
  tracking: OrderTracking | null
): FulfillmentState {
  switch (tracking?.status) {
    case "delivered":
      return "delivered";
    case "returned":
      return "returned";
    case "failure":
      return "failed";
    case "transit":
      return "in_transit";
    default:
      break;
  }
  if (md.shipping_email_sent_at) return "shipped";
  if (md.tracking_number) return "label_bought";
  return "unfulfilled";
}

function parseTracking(md: Stripe.Metadata): OrderTracking | null {
  const number = md.tracking_number;
  if (!number) return null;

  const carrier: Carrier = isCarrier(md.tracking_carrier)
    ? md.tracking_carrier
    : detectCarrier(number);
  const status = isTrackingStatus(md.trk_status) ? md.trk_status : null;

  return {
    number,
    carrier,
    url: md.tracking_url || trackUrl(number, carrier),
    status,
    statusAt: date(md.trk_status_at),
    etaAt: date(md.trk_eta),
    transitStartedAt: date(md.trk_transit_at),
    deliveredAt: date(md.trk_delivered_at),
  };
}

/**
 * Refund state off the charge.
 *
 * A null charge means we could not resolve one, which is not the same as "no
 * refunds" — but reporting zero is the only honest option available, and the
 * refund action re-reads the charge itself before moving money, so nothing
 * depends on this being complete.
 */
export function refundSummary(charge: Stripe.Charge | null): RefundSummary {
  const captured = charge?.amount_captured ?? charge?.amount ?? 0;
  const refunded = charge?.amount_refunded ?? 0;
  const refundable = Math.max(0, captured - refunded);
  return {
    state: refunded === 0 ? "none" : refundable === 0 ? "full" : "partial",
    amountRefundedCents: refunded,
    refundableCents: refundable,
    disputed: Boolean(charge?.disputed),
  };
}

export function toOrder(pi: Stripe.PaymentIntent, charge: Stripe.Charge | null): Order {
  const md = pi.metadata ?? {};
  const shipping = charge?.shipping ?? null;
  const tracking = parseTracking(md);
  const refund = refundSummary(charge);
  const cancelledAt = date(md.cancelled_at);
  const state = deriveState(md, tracking);

  return {
    id: pi.id,
    createdAt: new Date(pi.created * 1000),
    amountCents: pi.amount,
    subtotalCents: num(md.subtotal_cents),
    discountCents: num(md.discount_cents),
    shippingCents: num(md.shipping_cents),
    taxCents: num(md.tax_cents),
    couponCode: md.coupon_code || null,
    lines: parseLines(md),
    customerName: shipping?.name ?? charge?.billing_details?.name ?? null,
    customerEmail:
      pi.receipt_email ??
      charge?.receipt_email ??
      charge?.billing_details?.email ??
      null,
    customerPhone: charge?.billing_details?.phone ?? shipping?.phone ?? null,
    shipTo: shipping?.address ?? charge?.billing_details?.address ?? null,
    receiptUrl: charge?.receipt_url ?? null,
    chargeId: charge?.id ?? null,
    shippingCostCents: md.shipping_cost_cents ? num(md.shipping_cost_cents) : null,
    labelBoughtAt: date(md.label_bought_at),
    shippingEmailSentAt: date(md.shipping_email_sent_at),
    tracking,
    refund,
    cancelledAt,
    cancelledReason: md.cancelled_reason || null,
    state,
    needsAttention:
      cancelledAt === null &&
      refund.state !== "full" &&
      (state === "unfulfilled" ||
        state === "label_bought" ||
        state === "returned" ||
        state === "failed" ||
        // Moving or arrived, but the customer was never told.
        ((state === "in_transit" || state === "delivered") &&
          !md.shipping_email_sent_at)),
  };
}

/** One collapsed badge for the table. Money and intent outrank logistics. */
export type OrderRowStatus = FulfillmentState | "cancelled" | "refunded";

export function rowStatus(o: Order): OrderRowStatus {
  if (o.cancelledAt) return "cancelled";
  if (o.refund.state === "full") return "refunded";
  return o.state;
}

/** Default table filter: what still needs a human. */
export function isOpen(o: Order): boolean {
  return o.needsAttention;
}

/**
 * Recent orders, newest first.
 *
 * Only `succeeded` intents are orders. The storefront creates a PaymentIntent
 * as soon as checkout is opened, so the account holds far more abandoned
 * intents than sales — listing anything else would bury two real orders under
 * twenty carts that never paid.
 *
 * `expand: ["data.payment_intent"]` is load-bearing, not a tidy-up: without it
 * this made one request per charge (51 round-trips for a 50-order page) and the
 * page got slower with every sale.
 */
export async function listOrders(stripe: Stripe, limit = 50): Promise<Order[]> {
  const charges = await stripe.charges.list({
    limit,
    expand: ["data.payment_intent"],
  });

  const orders: Order[] = [];
  for (const charge of charges.data) {
    if (charge.status !== "succeeded" || !charge.paid) continue;
    // Expanded, so this is the object rather than an id. A string here means
    // the expand did not take effect; skip rather than fan out into an N+1.
    const pi = charge.payment_intent;
    if (!pi || typeof pi === "string") continue;
    orders.push(toOrder(pi, charge));
  }

  return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** One order by PaymentIntent id, or null when it is not a real sale. */
export async function getOrder(stripe: Stripe, piId: string): Promise<Order | null> {
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== "succeeded") return null;
  const charge = await resolveCharge(stripe, pi);
  return toOrder(pi, charge);
}

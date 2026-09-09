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
 */
import type Stripe from "stripe";
import { resolveCharge } from "@/lib/stripe-charge";

export interface OrderLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export type FulfillmentState = "unfulfilled" | "label_bought" | "shipped";

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
  /** Set once a label is bought. */
  trackingNumber: string | null;
  trackingCarrier: string | null;
  /** What the postage actually cost us, when known. */
  shippingCostCents: number | null;
  /** Set once the customer has been told it shipped. */
  shippingEmailSentAt: Date | null;
  state: FulfillmentState;
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

/**
 * Fulfilment state, derived rather than stored.
 *
 * Three states because the middle one is real and matters: a label can be
 * bought and printed while the customer has not been told. Collapsing that
 * into "shipped" would hide the orders most likely to be forgotten.
 */
function deriveState(md: Stripe.Metadata): FulfillmentState {
  if (md.shipping_email_sent_at) return "shipped";
  if (md.tracking_number) return "label_bought";
  return "unfulfilled";
}

export function toOrder(pi: Stripe.PaymentIntent, charge: Stripe.Charge | null): Order {
  const md = pi.metadata ?? {};
  const shipping = charge?.shipping ?? null;
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
    trackingNumber: md.tracking_number || null,
    trackingCarrier: md.tracking_carrier || null,
    shippingCostCents: md.shipping_cost_cents ? num(md.shipping_cost_cents) : null,
    shippingEmailSentAt: md.shipping_email_sent_at
      ? new Date(md.shipping_email_sent_at)
      : null,
    state: deriveState(md),
  };
}

/**
 * Recent orders, newest first.
 *
 * Only `succeeded` intents are orders. The storefront creates a PaymentIntent
 * as soon as checkout is opened, so the account holds far more abandoned
 * intents than sales — listing anything else would bury two real orders under
 * twenty carts that never paid.
 */
export async function listOrders(
  stripe: Stripe,
  limit = 50
): Promise<Order[]> {
  const charges = await stripe.charges.list({ limit });
  const succeeded = charges.data.filter((c) => c.status === "succeeded" && c.paid);

  const orders = await Promise.all(
    succeeded.map(async (charge) => {
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!piId) return null;
      const pi = await stripe.paymentIntents.retrieve(piId);
      return toOrder(pi, charge);
    })
  );

  return orders
    .filter((o): o is Order => o !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** One order by PaymentIntent id, or null when it is not a real sale. */
export async function getOrder(
  stripe: Stripe,
  piId: string
): Promise<Order | null> {
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== "succeeded") return null;
  const charge = await resolveCharge(stripe, pi);
  return toOrder(pi, charge);
}

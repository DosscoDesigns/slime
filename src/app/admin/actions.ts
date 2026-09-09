"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  cookieOptions,
  createSession,
  passwordOk,
} from "@/lib/admin-auth";
import { getStripe } from "@/lib/admin-session";
import { isSignedIn } from "@/lib/admin-session";
import { getOrder, type Order } from "@/lib/orders";
import { patchOrderMetadata } from "@/lib/order-metadata";
import { resolveCharge } from "@/lib/stripe-charge";
import { parseAmountToCents } from "@/lib/money-input";
import { fetchTrack, isTerminal, registerTracking } from "@/lib/tracking";
import { renderShippingNotice } from "@/lib/order-email";
import { sendMail } from "@/lib/mailgun";
import { printZpl } from "@/lib/print";
import {
  getRates,
  buyLabel,
  fetchLabelZpl,
  exceedsDimWeightThreshold,
  isTestMode,
  type Parcel,
} from "@/lib/shipping";
import { logError, logInfo, logWarn, errorContext } from "@/lib/logger";

export interface ActionResult {
  ok: boolean;
  message: string;
  /** Set on a successful quote so the UI can offer the rate. */
  rates?: Array<{ id: string; label: string; amountCents: number; days: number | null }>;
}

/**
 * Every mutating action re-checks the session itself.
 *
 * A server action is a POST endpoint, reachable without ever rendering the
 * page that guards it — so the page's requireAdmin() is not this function's
 * access control. Guarding only the render would leave label-buying open.
 */
async function assertAdmin(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("not signed in");
}

/**
 * Refresh both admin routes.
 *
 * The list was previously never revalidated, so an action taken on the detail
 * page left a stale row behind when you navigated back — the client router
 * cache had no reason to know anything had changed.
 */
function revalidateOrder(orderId: string): void {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

/**
 * Load an order and refuse to act on a cancelled one.
 *
 * Quoting is included even though it spends nothing: a quote is the first step
 * of buying a label, and the point of cancelling is to stop that sequence
 * before it starts rather than at the till.
 */
async function loadActionable(
  stripe: ReturnType<typeof getStripe>,
  orderId: string
): Promise<{ order: Order } | { error: ActionResult }> {
  const order = await getOrder(stripe, orderId);
  if (!order) return { error: { ok: false, message: "Order not found." } };
  if (order.cancelledAt) {
    return {
      error: {
        ok: false,
        message: `That order was cancelled ${order.cancelledAt.toLocaleString()}. Un-cancel it first.`,
      },
    };
  }
  return { order };
}

export async function signIn(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const password = formData.get("password");
  if (!passwordOk(password)) {
    // Deliberately vague and uniform: a message that distinguished "no
    // password configured" from "wrong password" would leak configuration.
    logInfo("admin sign-in refused");
    return { ok: false, message: "Incorrect password." };
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSession(), cookieOptions());
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

function parcelFrom(formData: FormData): Parcel {
  const n = (k: string) => Number(formData.get(k));
  const parcel = {
    lengthIn: n("length"),
    widthIn: n("width"),
    heightIn: n("height"),
    weightLb: n("weight"),
  };
  const bad = Object.entries(parcel).filter(([, v]) => !(v > 0));
  if (bad.length) {
    throw new Error(`every dimension and weight must be greater than zero (${bad.map(([k]) => k).join(", ")})`);
  }
  return parcel;
}

/** Quote only. Buys nothing, prints nothing. */
export async function quoteShipping(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  try {
    const loaded = await loadActionable(getStripe(), String(formData.get("orderId")));
    if ("error" in loaded) return loaded.error;
    const { order } = loaded;
    if (!order.shipTo) return { ok: false, message: "That order has no shipping address." };

    const parcel = parcelFrom(formData);
    const { rates } = await getRates(
      {
        name: order.customerName ?? "Customer",
        street1: order.shipTo.line1 ?? "",
        street2: order.shipTo.line2 ?? undefined,
        city: order.shipTo.city ?? "",
        state: order.shipTo.state ?? "",
        zip: order.shipTo.postal_code ?? "",
        country: order.shipTo.country ?? "US",
        email: order.customerEmail ?? undefined,
        phone: order.customerPhone ?? undefined,
      },
      parcel
    );

    const warn = exceedsDimWeightThreshold(parcel)
      ? " — WARNING: over 1 cu ft, USPS bills dimensional weight above this."
      : "";
    return {
      ok: true,
      message: `${rates.length} rates${isTestMode() ? " (Shippo TEST mode)" : ""}${warn}`,
      rates: rates.map((r) => ({
        id: r.id,
        label: `${r.provider} ${r.service}`,
        amountCents: r.amountCents,
        days: r.estimatedDays,
      })),
    };
  } catch (err) {
    logError("admin quote failed", errorContext(err));
    return { ok: false, message: err instanceof Error ? err.message : "Quote failed." };
  }
}

/**
 * Buy a label, print it, and record the tracking number.
 *
 * Order of operations is deliberate: the tracking number is written to Stripe
 * BEFORE anything else can fail, because a bought label that nothing recorded
 * is money spent with no way to find it again. Printing failing after that is
 * recoverable — the label can be reprinted from its URL — so a print error is
 * reported without discarding the purchase.
 *
 * The customer is NOT emailed here. That is a separate, explicit action.
 */
export async function buyAndPrintLabel(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const rateId = String(formData.get("rateId"));
  if (!rateId) return { ok: false, message: "Pick a rate first." };

  const stripe = getStripe();
  const loaded = await loadActionable(stripe, orderId);
  if ("error" in loaded) return loaded.error;
  const { order } = loaded;
  if (order.tracking) {
    return { ok: false, message: `Already has tracking ${order.tracking.number} — refusing to buy a second label.` };
  }

  let label;
  try {
    // The order id rides along on the Shippo transaction so that an inbound
    // tracking webhook carries its own reference and needs no lookup.
    label = await buyLabel(rateId, orderId);
  } catch (err) {
    logError("admin label purchase failed", { orderId, ...errorContext(err) });
    return { ok: false, message: err instanceof Error ? err.message : "Label purchase failed." };
  }

  try {
    // Only the keys this action owns. Stripe merges metadata, so re-sending a
    // snapshot of every other key would just create a window in which a
    // concurrent write (the tracking webhook) gets silently reverted.
    await patchOrderMetadata(stripe, orderId, {
      tracking_number: label.trackingNumber,
      // The real carrier off the rate, not a hardcoded "usps" — GET /tracks/
      // needs the right token, and we do not only ship USPS forever.
      tracking_carrier: (label.provider || "usps").toLowerCase(),
      // Shippo's own link, which knows more than our shape-guessing table.
      tracking_url: label.trackingUrl || "",
      shipping_cost_cents: String(label.amountCents),
      label_bought_at: new Date().toISOString(),
    });
  } catch (err) {
    // The label exists and is charged; losing the reference is the real harm.
    logError("BOUGHT A LABEL BUT COULD NOT RECORD IT — tracking may be orphaned", {
      orderId,
      tracking: label.trackingNumber,
      labelUrl: label.labelUrl,
      ...errorContext(err),
    });
    return {
      ok: false,
      message: `Label bought (${label.trackingNumber}) but Stripe was not updated. Record it by hand — see logs.`,
    };
  }

  revalidateOrder(orderId);

  // Subscribe the number so tracking events flow to our webhook tagged with
  // this order. Labels bought through Shippo already push events to a
  // registered webhook without this, so a failure here costs us the tag, not
  // the tracking — never the label purchase that already succeeded.
  try {
    await registerTracking(
      (label.provider || "usps").toLowerCase() as Parameters<typeof registerTracking>[0],
      label.trackingNumber,
      orderId
    );
  } catch (err) {
    logWarn("could not register tracking for webhook updates", {
      orderId,
      tracking: label.trackingNumber,
      ...errorContext(err),
    });
  }

  try {
    const zpl = await fetchLabelZpl(label.labelUrl);
    await printZpl({ zpl, printer: "4x6" });
  } catch (err) {
    logError("label bought but not printed", { orderId, ...errorContext(err) });
    return {
      ok: true,
      message: `Label bought (${label.trackingNumber}) but printing failed: ${
        err instanceof Error ? err.message : "unknown"
      }. Tracking is saved; reprint from Shippo.`,
    };
  }

  return { ok: true, message: `Label bought and printed — ${label.trackingNumber}` };
}

/** Tell the customer it shipped. Outbound mail; deliberately its own button. */
export async function emailCustomer(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const stripe = getStripe();

  const loaded = await loadActionable(stripe, orderId);
  if ("error" in loaded) return loaded.error;
  const { order } = loaded;
  if (!order.tracking) return { ok: false, message: "No tracking number yet." };
  if (order.shippingEmailSentAt) {
    return { ok: false, message: `Already emailed ${order.shippingEmailSentAt.toISOString()} — refusing to double-send.` };
  }
  if (!order.customerEmail) return { ok: false, message: "No customer email on this order." };

  const pi = await stripe.paymentIntents.retrieve(orderId);
  const charge = await resolveCharge(stripe, pi);

  const mail = renderShippingNotice({
    pi,
    charge,
    tracking: order.tracking.number,
    carrier: order.tracking.carrier,
  });
  try {
    await sendMail({ to: order.customerEmail, ...mail });
  } catch (err) {
    logError("admin shipping notice failed to send", { orderId, ...errorContext(err) });
    return { ok: false, message: err instanceof Error ? err.message : "Send failed." };
  }

  // Writes ONLY the key this action owns. The previous version snapshotted the
  // whole metadata map before the send above, then wrote that snapshot back
  // afterwards — a multi-second window in which an inbound tracking update
  // would be silently reverted.
  await patchOrderMetadata(stripe, orderId, {
    shipping_email_sent_at: new Date().toISOString(),
  });
  revalidateOrder(orderId);
  return { ok: true, message: `Emailed ${order.customerEmail}` };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tracking
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Pull live status from Shippo and cache it.
 *
 * Called from a client component on mount and from the refresh button, NOT
 * during the server render of the order page. That page is the only way to buy
 * a label, and a slow or down Shippo must never be able to take fulfilment
 * offline for the sake of a status line.
 *
 * Costs nothing: Shippo bills per unique tracking number created outside
 * Shippo, and ours all came from labels bought there.
 */
export async function refreshTracking(orderId: string): Promise<ActionResult> {
  await assertAdmin();
  const stripe = getStripe();

  const order = await getOrder(stripe, orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (!order.tracking) return { ok: false, message: "No tracking number yet." };

  // Terminal means terminal — the parcel has stopped moving and nothing further
  // will arrive, so there is nothing to ask about.
  if (isTerminal(order.tracking.status)) {
    return { ok: true, message: `Already ${order.tracking.status}.` };
  }

  let snapshot;
  try {
    snapshot = await fetchTrack(order.tracking.carrier, order.tracking.number);
  } catch (err) {
    logWarn("tracking refresh failed", { orderId, ...errorContext(err) });
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach the carrier.",
    };
  }

  await patchOrderMetadata(stripe, orderId, {
    trk_status: snapshot.status,
    // Shippo's status_date — when the carrier scanned it. Never Date.now():
    // webhook lag and backfill both make "now" wrong by hours, and these
    // timestamps are what the delivery-time numbers are computed from.
    trk_status_at: snapshot.statusAt?.toISOString() ?? "",
    trk_eta: snapshot.etaAt?.toISOString() ?? "",
    // Captured now because tracking_history ages out: an uncaptured first scan
    // is unrecoverable for that order forever.
    trk_transit_at: snapshot.transitStartedAt?.toISOString() ?? "",
    trk_delivered_at: snapshot.deliveredAt?.toISOString() ?? "",
  });
  revalidateOrder(orderId);

  return { ok: true, message: snapshot.statusDetail ?? snapshot.status };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Money and cancellation
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Issue a refund. THIS MOVES REAL MONEY.
 *
 * Guardrails, in order of how much they matter:
 *
 *  1. An idempotency key derived from a nonce the server rendered into the
 *     page. A double-click, a back-button resubmit and a React retry all reuse
 *     it, so Stripe returns the ORIGINAL refund instead of issuing a second
 *     one. Refunding twice deliberately requires a fresh page load.
 *  2. The refundable balance is re-read from Stripe inside this action. The
 *     rendered page may be minutes stale, and a refund issued in the Dashboard
 *     in the meantime must not be double-counted here.
 *  3. The operator types the amount, which must match to the cent.
 *
 * The ops address is emailed on success because, with no database, that mail is
 * the only audit trail this refund will ever have.
 */
export async function refundOrder(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const nonce = String(formData.get("nonce") || "");
  const confirm = String(formData.get("confirm") || "");
  const reasonRaw = String(formData.get("reason") || "");

  const amountCents = parseAmountToCents(String(formData.get("amount") || ""));
  if (amountCents === null || amountCents <= 0) {
    return { ok: false, message: "Enter an amount like 29.63." };
  }
  if (parseAmountToCents(confirm) !== amountCents) {
    return {
      ok: false,
      message: "The confirmation amount does not match. Type the exact amount again.",
    };
  }
  if (!nonce) return { ok: false, message: "Stale form — reload the page and try again." };

  const stripe = getStripe();
  const order = await getOrder(stripe, orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (!order.chargeId) return { ok: false, message: "No charge to refund against." };

  // Re-read rather than trusting what the page rendered.
  const charge = await stripe.charges.retrieve(order.chargeId);
  const refundable = (charge.amount_captured ?? charge.amount) - charge.amount_refunded;
  if (charge.disputed) {
    return { ok: false, message: "This charge is disputed — resolve the dispute in Stripe instead." };
  }
  if (amountCents > refundable) {
    return {
      ok: false,
      message: `Only $${(refundable / 100).toFixed(2)} is still refundable on this charge.`,
    };
  }

  const reason =
    reasonRaw === "duplicate" || reasonRaw === "fraudulent" || reasonRaw === "requested_by_customer"
      ? reasonRaw
      : undefined;

  logInfo("ISSUING REFUND", { orderId, charge: charge.id, amount_cents: amountCents });

  let refund;
  try {
    refund = await stripe.refunds.create(
      {
        charge: charge.id,
        amount: amountCents,
        ...(reason ? { reason } : {}),
      },
      { idempotencyKey: `refund:${orderId}:${nonce}` }
    );
  } catch (err) {
    logError("REFUND FAILED", { orderId, amount_cents: amountCents, ...errorContext(err) });
    return { ok: false, message: err instanceof Error ? err.message : "Refund failed." };
  }

  logInfo("REFUND ISSUED", {
    orderId,
    refund_id: refund.id,
    amount_cents: refund.amount,
    status: refund.status,
  });

  // Best-effort audit trail. A mail failure must not make a completed refund
  // look like it failed.
  const opsTo = process.env.ORDER_NOTIFICATION_EMAIL;
  if (opsTo) {
    const amount = `$${(refund.amount / 100).toFixed(2)}`;
    try {
      await sendMail({
        to: opsTo,
        subject: `Refund issued — ${amount} on ${orderId}`,
        text: [
          `A refund was issued from the admin portal.`,
          ``,
          `  Order:    ${orderId}`,
          `  Customer: ${order.customerName ?? "(no name)"}`,
          `  Amount:   ${amount}`,
          `  Reason:   ${reason ?? "(none given)"}`,
          `  Refund:   ${refund.id} (${refund.status})`,
          ``,
          `There is no orders database, so this email is the audit trail.`,
        ].join("\n"),
        html: `<p>A refund was issued from the admin portal.</p><ul><li>Order: <code>${orderId}</code></li><li>Customer: ${order.customerName ?? "(no name)"}</li><li>Amount: <strong>${amount}</strong></li><li>Reason: ${reason ?? "(none given)"}</li><li>Refund: <code>${refund.id}</code> (${refund.status})</li></ul><p>There is no orders database, so this email is the audit trail.</p>`,
      });
    } catch (err) {
      logError("refund issued but the ops notice failed to send", {
        orderId,
        refund_id: refund.id,
        ...errorContext(err),
      });
    }
  }

  revalidateOrder(orderId);
  return { ok: true, message: `Refunded $${(refund.amount / 100).toFixed(2)} (${refund.status}).` };
}

/**
 * Mark an order cancelled.
 *
 * Cancelling does NOT refund. The two are separate because an order can be
 * cancelled for reasons that do not warrant returning money and refunded for
 * reasons that do not stop fulfilment — but a cancelled order with the money
 * still held is the worst state in the system, so the UI defaults to doing both
 * and this action refuses to quietly cancel a funded order without being told
 * to.
 *
 * Deliberately NOT stripe.paymentIntents.cancel(): that only works before
 * capture, and it would take the PaymentIntent out of `succeeded`, which would
 * un-burn the single-use coupon the customer already spent.
 */
export async function cancelOrder(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") || "").trim();
  const acknowledgeUnrefunded = formData.get("acknowledgeUnrefunded") === "on";

  const stripe = getStripe();
  const order = await getOrder(stripe, orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (order.cancelledAt) {
    return { ok: false, message: `Already cancelled ${order.cancelledAt.toLocaleString()}.` };
  }
  if (order.refund.state !== "full" && !acknowledgeUnrefunded) {
    return {
      ok: false,
      message: `$${(order.refund.refundableCents / 100).toFixed(
        2
      )} is still held on this order. Refund it first, or tick the box to cancel without refunding.`,
    };
  }
  if (order.refund.state !== "full" && !reason) {
    return { ok: false, message: "Cancelling without a refund needs a reason." };
  }

  await patchOrderMetadata(stripe, orderId, {
    cancelled_at: new Date().toISOString(),
    cancelled_reason: reason,
  });
  logInfo("order cancelled", { orderId, refunded: order.refund.state, reason });
  revalidateOrder(orderId);
  return { ok: true, message: "Order cancelled." };
}

/** Undo a cancellation. Mistakes happen; this is a note about intent. */
export async function uncancelOrder(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const stripe = getStripe();

  // "" is how Stripe unsets a single metadata key.
  await patchOrderMetadata(stripe, orderId, {
    cancelled_at: "",
    cancelled_reason: "",
  });
  logInfo("order un-cancelled", { orderId });
  revalidateOrder(orderId);
  return { ok: true, message: "Cancellation reversed." };
}

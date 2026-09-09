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
import { getOrder } from "@/lib/orders";
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
import { logError, logInfo, errorContext } from "@/lib/logger";

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
    const order = await getOrder(getStripe(), String(formData.get("orderId")));
    if (!order?.shipTo) return { ok: false, message: "That order has no shipping address." };

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
  const order = await getOrder(stripe, orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (order.trackingNumber) {
    return { ok: false, message: `Already has tracking ${order.trackingNumber} — refusing to buy a second label.` };
  }

  let label;
  try {
    label = await buyLabel(rateId);
  } catch (err) {
    logError("admin label purchase failed", { orderId, ...errorContext(err) });
    return { ok: false, message: err instanceof Error ? err.message : "Label purchase failed." };
  }

  try {
    await stripe.paymentIntents.update(orderId, {
      metadata: {
        ...(await stripe.paymentIntents.retrieve(orderId)).metadata,
        tracking_number: label.trackingNumber,
        tracking_carrier: "usps",
        shipping_cost_cents: String(label.amountCents),
      },
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

  revalidatePath(`/admin/orders/${orderId}`);

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

  const pi = await stripe.paymentIntents.retrieve(orderId);
  const order = await getOrder(stripe, orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (!order.trackingNumber) return { ok: false, message: "No tracking number yet." };
  if (order.shippingEmailSentAt) {
    return { ok: false, message: `Already emailed ${order.shippingEmailSentAt.toISOString()} — refusing to double-send.` };
  }
  if (!order.customerEmail) return { ok: false, message: "No customer email on this order." };

  const charge = pi.latest_charge
    ? await stripe.charges.retrieve(String(pi.latest_charge))
    : (await stripe.charges.list({ payment_intent: orderId, limit: 1 })).data[0] ?? null;

  const mail = renderShippingNotice({ pi, charge, tracking: order.trackingNumber });
  try {
    await sendMail({ to: order.customerEmail, ...mail });
  } catch (err) {
    logError("admin shipping notice failed to send", { orderId, ...errorContext(err) });
    return { ok: false, message: err instanceof Error ? err.message : "Send failed." };
  }

  await stripe.paymentIntents.update(orderId, {
    metadata: { ...pi.metadata, shipping_email_sent_at: new Date().toISOString() },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: `Emailed ${order.customerEmail}` };
}

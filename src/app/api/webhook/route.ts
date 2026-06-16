import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendMail } from "@/lib/mailgun";
import { renderOrderEmail } from "@/lib/order-email";

// Stripe signature verification needs the exact raw request bytes, so this
// route reads request.text() rather than parsed JSON. Run on the Node
// runtime; never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "missing stripe-signature header" },
      { status: 400 }
    );
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    // constructEventAsync works with the fetch HTTP client / web-crypto and
    // is the safe choice on Vercel.
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.warn(
      "stripe signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true, action: "ignored" });
  }

  const pi = event.data.object as Stripe.PaymentIntent;

  // Idempotency: a flag written back to PI metadata short-circuits retries
  // and duplicate deliveries.
  if (pi.metadata.order_email_sent_at) {
    return NextResponse.json({ received: true, action: "skipped_duplicate" });
  }

  const notificationEmail = pi.metadata.notification_email;
  if (!notificationEmail) {
    console.warn(`no notification_email in PI metadata (${pi.id}) — skipping`);
    return NextResponse.json({ received: true, action: "no_recipient" });
  }

  // Pull the latest charge for customer/shipping/billing details.
  let charge: Stripe.Charge | null = null;
  if (pi.latest_charge) {
    charge =
      typeof pi.latest_charge === "string"
        ? await stripe.charges.retrieve(pi.latest_charge)
        : pi.latest_charge;
  }

  const { subject, text, html } = renderOrderEmail({ pi, charge });

  // BCC the customer so they get the same confirmation without exposing the
  // owner address in the To: header. Email comes from the LinkAuthentication
  // element (billing_details) — we do NOT set receipt_email, so Stripe does
  // not send a competing auto-receipt.
  const customerEmail =
    pi.receipt_email ??
    charge?.receipt_email ??
    charge?.billing_details?.email ??
    undefined;

  try {
    await sendMail({
      to: notificationEmail,
      bcc: customerEmail ?? undefined,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error(
      `mailgun send failed (${pi.id}):`,
      err instanceof Error ? err.message : err
    );
    // 500 → Stripe retries. PI flag NOT set, so the retry re-attempts send.
    return NextResponse.json({ error: "mail send failed" }, { status: 500 });
  }

  // Flag the PI so a duplicate delivery doesn't double-send. Non-fatal on
  // failure — worst case is a second email, preferable to none.
  try {
    await stripe.paymentIntents.update(pi.id, {
      metadata: {
        ...pi.metadata,
        order_email_sent_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn(
      `failed to flag PI as notified (${pi.id}):`,
      err instanceof Error ? err.message : err
    );
  }

  return NextResponse.json({ received: true, action: "notified" });
}

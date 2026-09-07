import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sendMail } from "@/lib/mailgun";
import { renderCustomerReceipt, renderOpsNotice } from "@/lib/order-email";
import { logError, logInfo, logWarn, errorContext } from "@/lib/logger";
import { resolveCharge } from "@/lib/stripe-charge";

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
    logError("STRIPE_WEBHOOK_SECRET is not set — webhook cannot verify events");
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
    logWarn("stripe signature verification failed", errorContext(err));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true, action: "ignored" });
  }

  const pi = event.data.object as Stripe.PaymentIntent;

  // Idempotency: flags written back to PI metadata short-circuit retries and
  // duplicate deliveries. The two mails are tracked SEPARATELY so that a
  // failure on one cannot cause the other to be sent twice on Stripe's retry.
  //
  // `order_email_sent_at` is the legacy flag from when both parties shared a
  // single BCC'd email; an order bearing it has already been fully notified,
  // so it counts for both.
  const legacyCombinedSent = Boolean(pi.metadata.order_email_sent_at);
  const opsAlreadySent = legacyCombinedSent || Boolean(pi.metadata.ops_email_sent_at);
  const customerAlreadySent =
    legacyCombinedSent || Boolean(pi.metadata.customer_email_sent_at);

  if (opsAlreadySent && customerAlreadySent) {
    return NextResponse.json({ received: true, action: "skipped_duplicate" });
  }

  // Prefer the recipient baked into the PI at creation, but fall back to the
  // current env value so an older PI (or one created before the env var was
  // set) still notifies someone instead of being silently dropped.
  const notificationEmail =
    pi.metadata.notification_email || process.env.ORDER_NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    logError(
      "ORDER_NOTIFICATION_EMAIL unset and no notification_email in PI metadata — order NOT emailed to anyone",
      { payment_intent: pi.id, amount: pi.amount }
    );
    return NextResponse.json({ received: true, action: "no_recipient" });
  }

  const charge = await resolveCharge(stripe, pi);

  // The buyer's address comes from the LinkAuthentication element
  // (billing_details). We never set receipt_email, so Stripe sends no
  // competing auto-receipt — which makes our customer mail the only record
  // they get.
  const customerEmail =
    pi.receipt_email ??
    charge?.receipt_email ??
    charge?.billing_details?.email ??
    undefined;

  // Two SEPARATE messages, not one with a BCC. A BCC'd send gives every
  // recipient the same Message-ID, so a mail client dedupes them and an owner
  // who is also the buyer sees only one copy — and either way the customer
  // received an internal fulfillment ticket written for the shop.
  const sentNow: Record<string, string> = {};
  const failures: string[] = [];

  if (!opsAlreadySent) {
    const mail = renderOpsNotice({ pi, charge });
    try {
      await sendMail({ to: notificationEmail, ...mail });
      sentNow.ops_email_sent_at = new Date().toISOString();
    } catch (err) {
      failures.push("ops");
      await logError("mailgun send failed — ops order notice NOT delivered", {
        payment_intent: pi.id,
        amount: pi.amount,
        to: notificationEmail,
        ...errorContext(err),
      });
    }
  }

  if (!customerAlreadySent) {
    if (!customerEmail) {
      // Nothing to retry against, so this must not 500 into a retry loop.
      logWarn("no customer email on the order — receipt NOT sent", {
        payment_intent: pi.id,
        amount: pi.amount,
      });
    } else {
      const mail = renderCustomerReceipt({ pi, charge });
      try {
        await sendMail({ to: customerEmail, ...mail });
        sentNow.customer_email_sent_at = new Date().toISOString();
      } catch (err) {
        failures.push("customer");
        await logError("mailgun send failed — customer receipt NOT delivered", {
          payment_intent: pi.id,
          amount: pi.amount,
          customer_email: customerEmail,
          ...errorContext(err),
        });
      }
    }
  }

  // Persist whatever actually sent BEFORE reporting failure, so Stripe's
  // retry re-attempts only the message that did not go out.
  if (Object.keys(sentNow).length > 0) {
    try {
      await stripe.paymentIntents.update(pi.id, {
        metadata: { ...pi.metadata, ...sentNow },
      });
    } catch (err) {
      logWarn("failed to flag PI as notified — a duplicate email is possible", {
        payment_intent: pi.id,
        ...errorContext(err),
      });
    }
  }

  if (failures.length > 0) {
    // 500 → Stripe retries; the flags above keep the retry from re-sending
    // whichever message already succeeded.
    return NextResponse.json(
      { error: `mail send failed: ${failures.join(", ")}` },
      { status: 500 }
    );
  }

  logInfo("order emails sent", {
    payment_intent: pi.id,
    amount: pi.amount,
    to: notificationEmail,
    customer_email: customerEmail,
    sent: Object.keys(sentNow).join(",") || "none",
  });

  return NextResponse.json({ received: true, action: "notified" });
}

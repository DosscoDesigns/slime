import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { priceCart, type CartLineInput } from "@/lib/pricing";
import { priceKitCents } from "@/lib/products";
import { cartToGa4Items, encodeGa4Items } from "@/lib/ga-items";
import { resolveOrderTotals } from "@/lib/coupon-redemption";
import { logError, logWarn, errorContext } from "@/lib/logger";

/**
 * GA4 ids arrive from the browser and are written straight into Stripe
 * metadata, so they are sanitized rather than trusted: both are short
 * dot-separated digit strings by Google's own format, and anything else is
 * dropped. Without this an attacker could stuff 500 characters of arbitrary
 * text into every order record.
 */
function safeGaId(value: unknown): string {
  return typeof value === "string" && /^[0-9]{1,20}(\.[0-9]{1,20})?$/.test(value)
    ? value
    : "";
}

/**
 * GA4 line items for the server-side purchase event, priced with the SAME
 * trusted recomputation the charge uses — never the client's priceCents, or a
 * tampered cart would report inflated revenue even though it charged correctly.
 *
 * Analytics must never break a checkout, so a failure here is swallowed and
 * costs only item-level detail; the order total comes off the PaymentIntent.
 */
function encodeGaItems(cartItems: CartLineInput[]): string {
  try {
    return encodeGa4Items(
      cartToGa4Items(
        cartItems.map((i) => ({
          priceCents: priceKitCents({
            gallons: i.gallons,
            color: i.color,
            addons: i.addons,
          }),
          quantity: i.quantity,
          gallons: i.gallons,
          color: i.color,
          addons: i.addons,
        }))
      )
    );
  } catch {
    return "";
  }
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const cartItems: CartLineInput[] = body.items
      ? body.items
      : [{ id: body.productId, quantity: body.quantity || 1 }];

    let priced;
    try {
      priced = priceCart(cartItems);
    } catch (err) {
      // Usually a retired add-on left in a returning customer's localStorage
      // cart. It presents to them as a checkout that simply refuses, so it
      // needs to be visible rather than a silent 400.
      logWarn("cart rejected at pricing", {
        items: cartItems,
        ...errorContext(err),
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid cart" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // No ship-to address yet at intent creation, so tax is 0 until the
    // customer enters a FL address (recomputed in /update-amount). Shipping
    // and any coupon discount don't depend on destination.
    const totals = await resolveOrderTotals(stripe, priced, body.couponCode);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.totalCents,
      currency: "usd",
      description: priced.description,
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: JSON.stringify(priced.lines),
        subtotal_cents: String(totals.subtotalCents),
        discount_cents: String(totals.discountCents),
        coupon_code: totals.couponCode ?? "",
        shipping_cents: String(totals.shippingCents),
        tax_cents: String(totals.taxCents),
        notification_email: process.env.ORDER_NOTIFICATION_EMAIL ?? "",
        // Captured here so the webhook can send GA4's purchase event
        // server-side and still attribute it to the session that produced it.
        // See src/lib/ga-measurement-protocol.ts.
        ga_client_id: safeGaId(body.gaClientId),
        ga_session_id: safeGaId(body.gaSessionId),
        ga_items: encodeGaItems(cartItems),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      ...totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("checkout intent creation failed", errorContext(error));
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  priceCart,
  computeOrderTotals,
  type CartLineInput,
} from "@/lib/pricing";
import { logError, logWarn, errorContext } from "@/lib/logger";

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

    // No ship-to address yet at intent creation, so tax is 0 until the
    // customer enters a FL address (recomputed in /update-amount). Shipping
    // and any coupon discount don't depend on destination.
    const totals = computeOrderTotals(priced, body.couponCode);

    const stripe = getStripe();
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

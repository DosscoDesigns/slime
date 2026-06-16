import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  priceCart,
  computeShippingCents,
  computeTaxCents,
  type CartLineInput,
} from "@/lib/pricing";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

interface UpdateBody {
  paymentIntentId: string;
  items: CartLineInput[];
  state?: string;
  country?: string;
}

// Recompute the order total when the customer's shipping address changes in
// the AddressElement. FL ship-to gets 7.5% sales tax; everywhere else is
// tax-free (single-state nexus). The PaymentIntent amount is updated so the
// charge reflects the correct total before confirmation. Mirrors rkpm.
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, items, country, state } =
      (await request.json()) as UpdateBody;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId required" },
        { status: 400 }
      );
    }

    let priced;
    try {
      priced = priceCart(items);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid cart" },
        { status: 400 }
      );
    }

    const shippingCents = computeShippingCents(priced.subtotalCents);
    const taxCents = computeTaxCents(priced.subtotalCents, country, state);
    const totalCents = priced.subtotalCents + shippingCents + taxCents;

    const stripe = getStripe();
    await stripe.paymentIntents.update(paymentIntentId, {
      amount: totalCents,
      metadata: {
        items: JSON.stringify(priced.lines),
        subtotal_cents: String(priced.subtotalCents),
        shipping_cents: String(shippingCents),
        tax_cents: String(taxCents),
        ship_to_state: state ?? "",
        ship_to_country: country ?? "",
        notification_email: process.env.ORDER_NOTIFICATION_EMAIL ?? "",
      },
    });

    return NextResponse.json({
      subtotalCents: priced.subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("update-amount error:", message);
    return NextResponse.json(
      { error: `Could not update amount: ${message}` },
      { status: 500 }
    );
  }
}

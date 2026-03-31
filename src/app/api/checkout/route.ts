import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const PRODUCTS: Record<
  string,
  { name: string; price: number; description: string }
> = {
  "slime-only": {
    name: "Slime Only — 20 Gallons",
    price: 1500,
    description: "4 color pouches (Red, Yellow, Green, Blue)",
  },
  "starter-kit": {
    name: "Starter Kit — 20 Gallons + Supplies",
    price: 5900,
    description: "4 color pouches, 4 buckets, 12 sprayers, 1 mixing paddle",
  },
  "youth-group-kit": {
    name: "Youth Group Kit — 80 Gallons",
    price: 19900,
    description:
      "16 color pouches, 16 buckets, 48 sprayers, 1 mixing paddle",
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both single item { productId, quantity } and multi-item { items: [{ id, quantity }] }
    const cartItems: { id: string; quantity: number }[] = body.items
      ? body.items
      : [{ id: body.productId, quantity: body.quantity || 1 }];

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of cartItems) {
      const product = PRODUCTS[item.id];
      if (!product) {
        return NextResponse.json(
          { error: `Invalid product: ${item.id}` },
          { status: 400 }
        );
      }
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.price,
        },
        quantity: item.quantity,
      });
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/#products`,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

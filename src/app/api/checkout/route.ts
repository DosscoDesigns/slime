import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

interface CartItemPayload {
  id: string;
  quantity: number;
  name?: string;
  subtitle?: string;
  price?: number;
  priceCents?: number;
  gallons?: number;
  color?: string;
  addons?: { id: string; name: string; priceCents: number; quantity: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const cartItems: CartItemPayload[] = body.items
      ? body.items
      : [{ id: body.productId, quantity: body.quantity || 1 }];

    let totalAmount = 0;
    const descriptionParts: string[] = [];

    for (const item of cartItems) {
      if (!item.priceCents || !item.name) {
        return NextResponse.json(
          { error: `Invalid cart item: ${item.id}` },
          { status: 400 }
        );
      }
      totalAmount += item.priceCents * item.quantity;
      descriptionParts.push(
        `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`
      );
    }

    if (totalAmount === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      description: descriptionParts.join(", "),
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: JSON.stringify(
          cartItems.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.quantity,
            cents: i.priceCents,
          }))
        ),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { priceCart, type CartLineInput } from "@/lib/pricing";
import { resolveOrderTotals } from "@/lib/coupon-redemption";
import { getRates } from "@/lib/shipping";
import {
  addressIsQuotable,
  buildOptions,
  decodeOptions,
  encodeOptions,
  fallbackOptions,
  isPoBox,
  parcelForCart,
  quoteKey,
  selectOption,
  type ShipToAddress,
  type ShippingOption,
} from "@/lib/shipping-quote";
import { logError, logWarn, errorContext } from "@/lib/logger";

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
  /** Full ship-to. Older clients sent only state/country; those still work. */
  address?: ShipToAddress;
  state?: string;
  country?: string;
  couponCode?: string;
  /** The option id the customer picked. Never an amount. */
  shippingOptionId?: string;
}

/**
 * A Shippo quote at checkout gets a short budget. Measured 1.9–2.7s against
 * the live API; past this the customer waits on a spinner, so the order goes
 * through at the fallback rate instead.
 */
const QUOTE_TIMEOUT_MS = 6_000;

/**
 * Get shipping options for this cart and address: the PaymentIntent's cached
 * quote when the destination and parcel are unchanged, else a fresh one.
 * Never throws: a failed quote becomes the fallback rate, which is NOT cached,
 * so the next address change tries Shippo again.
 */
async function shippingOptionsFor(
  pi: Stripe.PaymentIntent,
  items: CartLineInput[],
  address: ShipToAddress | undefined,
  subtotalCents: number
): Promise<{ options: ShippingOption[]; key: string; cache: string; source: string }> {
  if (!addressIsQuotable(address)) {
    return { options: fallbackOptions(subtotalCents), key: "", cache: "", source: "no-address" };
  }

  const parcel = parcelForCart(items);
  const key = quoteKey(address, parcel);

  // The cache is keyed on subtotal too, because the free-shipping pricing
  // depends on it (adding a kit can cross $100).
  const cacheKey = `${key}|${subtotalCents}`;
  if (pi.metadata.ship_quote_key === cacheKey) {
    const cached = decodeOptions(pi.metadata.ship_quote);
    if (cached) return { options: cached, key: cacheKey, cache: pi.metadata.ship_quote, source: "cache" };
  }

  try {
    const { rates } = await getRates(
      {
        // The carrier needs a name on the shipment; the real one is on the label later.
        name: "Customer",
        street1: address.line1 ?? "",
        street2: address.line2 ?? undefined,
        city: address.city ?? "",
        state: address.state ?? "",
        zip: address.postal_code ?? "",
        country: "US",
      },
      parcel,
      QUOTE_TIMEOUT_MS
    );
    const options = buildOptions(rates, subtotalCents, { poBox: isPoBox(address) });
    if (options.length === 0) throw new Error("no configured service was quoted");
    return { options, key: cacheKey, cache: encodeOptions(options), source: "shippo" };
  } catch (err) {
    logWarn("checkout shipping quote failed — charging the fallback rate", {
      state: address.state,
      zip: address.postal_code,
      box: parcel.boxId,
      weight_lb: parcel.weightLb,
      ...errorContext(err),
    });
    return { options: fallbackOptions(subtotalCents), key: "", cache: "", source: "fallback" };
  }
}

// Recompute the order total when the customer's address, shipping option or
// coupon changes. Shipping is a live Shippo quote; FL ship-to gets 7.5% sales
// tax on the discounted subtotal. The PaymentIntent amount is updated so the
// charge matches what is displayed before the customer confirms.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateBody;
    const { paymentIntentId, items, couponCode, shippingOptionId } = body;
    const address: ShipToAddress | undefined =
      body.address ?? (body.state || body.country ? { state: body.state, country: body.country } : undefined);
    const country = address?.country ?? body.country;
    const state = address?.state ?? body.state;

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

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === "succeeded" || pi.status === "canceled") {
      return NextResponse.json({ error: "This checkout is already closed." }, { status: 409 });
    }

    const quote = await shippingOptionsFor(pi, items, address, priced.subtotalCents);
    const chosen = selectOption(quote.options, shippingOptionId);

    const totals = await resolveOrderTotals(
      stripe,
      priced,
      couponCode,
      country,
      state,
      chosen.cents
    );

    await stripe.paymentIntents.update(paymentIntentId, {
      amount: totals.totalCents,
      metadata: {
        items: JSON.stringify(priced.lines),
        subtotal_cents: String(totals.subtotalCents),
        discount_cents: String(totals.discountCents),
        coupon_code: totals.couponCode ?? "",
        shipping_cents: String(totals.shippingCents),
        tax_cents: String(totals.taxCents),
        ship_to_state: state ?? "",
        ship_to_country: country ?? "",
        notification_email: process.env.ORDER_NOTIFICATION_EMAIL ?? "",
        // What the customer picked and what the carrier quoted, so the admin
        // can buy the same service and see the margin.
        shipping_service: chosen.id,
        shipping_service_token: chosen.token,
        shipping_quote_cents: String(chosen.carrierCents),
        shipping_quote_source: quote.source,
        ship_quote_key: quote.key,
        ship_quote: quote.cache,
      },
    });

    return NextResponse.json({
      ...totals,
      shippingOptions: quote.options.map((o) => ({
        id: o.id,
        label: o.label,
        cents: o.cents,
        days: o.days,
      })),
      shippingOptionId: chosen.id,
      shippingQuoted: quote.source === "shippo" || quote.source === "cache",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("update-amount failed", errorContext(error));
    return NextResponse.json(
      { error: `Could not update amount: ${message}` },
      { status: 500 }
    );
  }
}

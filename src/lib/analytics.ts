// Client-side e-commerce analytics: one typed event layer that fans out to
// BOTH GA4 and Plausible, so a call site never has to know which vendors are
// wired up.
//
// Why two vendors, deliberately:
//
//   GA4 is the only path to Google Ads and Merchant Center conversion data,
//   and it has a real e-commerce schema (items[] with price and quantity), so
//   it can answer "which add-on attaches to which kit". It is also cookie-based
//   and blocked for a meaningful slice of traffic.
//
//   Plausible is cookieless and survives ad blockers, so it is the honest
//   denominator — the traffic number to trust. It cannot do funnel analysis
//   anywhere near as well.
//
//   Neither one alone is both trustworthy and useful. Together, the GA4 number
//   is the shape and the Plausible number is the size.
//
// Three invariants, mirroring src/lib/logger.ts:
//
//   1. Analytics NEVER breaks a render or a checkout. Every call is wrapped
//      and swallowed. A tracking failure must not cost a sale.
//   2. Unconfigured is a supported state. With neither env var set every
//      function is a no-op, which is what local dev and previews want.
//   3. No PII leaves the browser. No email, no name, no address. Item ids,
//      quantities and money only.
//
// The pure item mapping lives in ga-items.ts because the server needs it too.

import { sendGAEvent } from "@next/third-parties/google";
import type { KitTier } from "@/lib/products";
import {
  GA_CURRENCY,
  cartItemToGa4Items,
  cartToGa4Items,
  itemsValue,
  tierToGa4Item,
  type TrackableCartItem,
} from "@/lib/ga-items";

export type { TrackableCartItem, Ga4Item } from "@/lib/ga-items";

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export const gaConfigured = Boolean(GA_MEASUREMENT_ID);
export const plausibleConfigured = Boolean(PLAUSIBLE_DOMAIN);

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: {
      (
        event: string,
        options?: {
          props?: PlausibleProps;
          revenue?: { currency: string; amount: number };
          callback?: () => void;
        }
      ): void;
      q?: unknown[];
    };
  }
}

const money = (cents: number) => Math.round(cents) / 100;

function ga(event: string, params: Record<string, unknown>): void {
  if (!gaConfigured) return;
  try {
    sendGAEvent("event", event, params);
  } catch {
    // Never terminal — see invariant 1.
  }
}

function plausible(
  event: string,
  props?: PlausibleProps,
  revenueAmount?: number
): void {
  if (!plausibleConfigured) return;
  try {
    window.plausible?.(event, {
      ...(props ? { props } : {}),
      ...(revenueAmount !== undefined
        ? { revenue: { currency: GA_CURRENCY, amount: revenueAmount } }
        : {}),
    });
  } catch {
    // Never terminal.
  }
}

/* ------------------------------------------------------------------ *
 * Funnel events
 * ------------------------------------------------------------------ */

/** The kit lineup scrolled into view. Fired once per page view. */
export function trackViewItemList(tiers: KitTier[], listName = "Kit Lineup") {
  ga("view_item_list", {
    item_list_name: listName,
    currency: GA_CURRENCY,
    items: tiers.map((t) => tierToGa4Item(t)),
  });
  plausible("View Kit Lineup");
}

/** A specific kit was chosen from the lineup. */
export function trackSelectItem(tier: KitTier, listName = "Kit Lineup") {
  ga("select_item", {
    item_list_name: listName,
    items: [tierToGa4Item(tier)],
  });
  plausible("Select Kit", { kit: `${tier.gallons}G` });
}

/** A kit's detail was viewed — its own page, or the configurator opening. */
export function trackViewItem(tier: KitTier) {
  ga("view_item", {
    currency: GA_CURRENCY,
    value: tier.basePrice,
    items: [tierToGa4Item(tier)],
  });
  plausible("View Kit", { kit: `${tier.gallons}G` });
}

export function trackAddToCart(item: TrackableCartItem) {
  const items = cartItemToGa4Items(item);
  ga("add_to_cart", { currency: GA_CURRENCY, value: itemsValue(items), items });
  plausible("Add to Cart", {
    kit: item.gallons ? `${item.gallons}G` : "unknown",
    addons: (item.addons ?? []).length,
  });
}

export function trackRemoveFromCart(item: TrackableCartItem) {
  const items = cartItemToGa4Items(item);
  ga("remove_from_cart", {
    currency: GA_CURRENCY,
    value: itemsValue(items),
    items,
  });
  plausible("Remove from Cart");
}

export function trackViewCart(cart: TrackableCartItem[]) {
  const items = cartToGa4Items(cart);
  ga("view_cart", { currency: GA_CURRENCY, value: itemsValue(items), items });
  plausible("View Cart");
}

export function trackBeginCheckout(cart: TrackableCartItem[]) {
  const items = cartToGa4Items(cart);
  ga("begin_checkout", {
    currency: GA_CURRENCY,
    value: itemsValue(items),
    items,
  });
  plausible("Begin Checkout");
}

/**
 * The customer completed their shipping address. This is the last step before
 * payment, so the gap between it and `purchase` is the payment-failure /
 * sticker-shock drop-off — the most actionable number in the funnel.
 */
export function trackAddShippingInfo(
  cart: TrackableCartItem[],
  totalCents: number
) {
  ga("add_shipping_info", {
    currency: GA_CURRENCY,
    value: money(totalCents),
    shipping_tier: "USPS Ground Advantage",
    items: cartToGa4Items(cart),
  });
  plausible("Add Shipping Info");
}

export function trackAddPaymentInfo(
  cart: TrackableCartItem[],
  totalCents: number,
  couponCode?: string | null
) {
  ga("add_payment_info", {
    currency: GA_CURRENCY,
    value: money(totalCents),
    ...(couponCode ? { coupon: couponCode } : {}),
    items: cartToGa4Items(cart),
  });
  plausible("Add Payment Info");
}

/**
 * Order confirmed, fired from /success.
 *
 * PLAUSIBLE ONLY, and that is on purpose. GA4's `purchase` is sent SERVER-SIDE
 * from the Stripe webhook (src/lib/ga-measurement-protocol.ts) because:
 *
 *   - /success is missable. A customer who closes the tab after Stripe's
 *     redirect still paid, and a client-side purchase event loses that sale.
 *   - The browser does not know the authoritative amount; the PaymentIntent
 *     does.
 *   - An ad blocker that eats gtag.js eats the revenue from the report.
 *
 * Firing it in both places would risk double-counting revenue, which is worse
 * than under-reporting because it is not obviously wrong. Plausible has no
 * server-side events API on standard plans, so its revenue goal stays here and
 * is knowingly the lossier of the two numbers.
 */
export function trackPurchase(valueCents: number) {
  plausible("Purchase", undefined, money(valueCents));
}

export function trackCouponApplied(code: string, accepted: boolean) {
  plausible("Coupon", { code: code.toUpperCase(), accepted });
}

/* ------------------------------------------------------------------ *
 * GA4 identity, for the server-side purchase event
 * ------------------------------------------------------------------ */

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * GA4's client id, pulled out of the `_ga` cookie.
 *
 * Format is `GA1.1.<part1>.<part2>`, and the client id Measurement Protocol
 * wants is the last two dot-segments joined. That layout is Google's own and
 * is not formally specified, so parse defensively: a miss returns undefined
 * and the server falls back rather than sending garbage.
 */
export function gaClientId(): string | undefined {
  const raw = readCookie("_ga");
  if (!raw) return undefined;
  const parts = raw.split(".");
  if (parts.length < 4) return undefined;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

/**
 * GA4's current session id, from the per-property `_ga_<container>` cookie.
 *
 * Without it a server-side purchase lands in its own session and the sale is
 * attributed to "(direct)" instead of the campaign that actually produced it —
 * which defeats most of the point of measuring at all.
 *
 * Format is `GS<v>.<n>.<session_id>.<session_number>...`.
 */
export function gaSessionId(): string | undefined {
  if (!GA_MEASUREMENT_ID) return undefined;
  const raw = readCookie(`_ga_${GA_MEASUREMENT_ID.replace(/^G-/, "")}`);
  if (!raw) return undefined;
  const parts = raw.split(".");
  return parts.length >= 3 ? parts[2] : undefined;
}

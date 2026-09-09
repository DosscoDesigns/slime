/**
 * Shippo tracking webhook.
 *
 * A thin shell: read the env, check the token, hand the body to
 * handleTrackUpdate (src/lib/shippo-webhook.ts), which is where the reasoning
 * and the tests live.
 *
 * Register the URL at https://portal.goshippo.com/api-config/webhooks as
 *   https://www.theslimecompany.com/api/shippo-webhook?token=<SHIPPO_WEBHOOK_TOKEN>
 * for the `track_updated` event.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { handleTrackUpdate } from "@/lib/shippo-webhook";
import { logError, logWarn, errorContext } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Length-safe constant-time compare — timingSafeEqual throws on a mismatch. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.SHIPPO_WEBHOOK_TOKEN;
  if (!expected) {
    logError("SHIPPO_WEBHOOK_TOKEN is not set — tracking webhook cannot authenticate");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const provided = request.nextUrl.searchParams.get("token") ?? "";
  if (!tokenMatches(provided, expected)) {
    logWarn("tracking webhook rejected: bad token");
    // 404 rather than 401: a prober learns nothing about whether this path is
    // a webhook at all.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true, action: "unparseable" });
  }

  const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        httpClient: Stripe.createFetchHttpClient(),
      })
    : null;
  if (!stripe) {
    logError("STRIPE_SECRET_KEY is not set — tracking webhook cannot record anything");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  try {
    const result = await handleTrackUpdate(stripe, body);
    // ALWAYS 200 once the token checked out, even when we did nothing with it.
    // Shippo's tracking webhooks are documented as not idempotent and a non-200
    // invites a retry storm — or, repeated, gets the endpoint disabled. An
    // event for a tracking number this deploy has never heard of is normal.
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    logError("tracking webhook blew up", errorContext(err));
    return NextResponse.json({ received: true, handled: false, reason: "error" });
  }
}

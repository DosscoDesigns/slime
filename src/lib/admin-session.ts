/**
 * Server-side session helpers for the admin screens.
 *
 * Split from admin-auth.ts so the pure crypto stays unit-testable without
 * next/headers, which only resolves inside a request.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { ADMIN_COOKIE, sessionValid } from "@/lib/admin-auth";

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return sessionValid(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Guard every admin screen. Redirects rather than rendering an error, so a
 * lapsed session lands on the login form instead of a dead end.
 *
 * Call this FIRST in a page — before any Stripe read — so an unauthenticated
 * request never causes customer data to be fetched at all.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isSignedIn())) redirect("/admin/login");
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const neg = cents < 0;
  return `${neg ? "-" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

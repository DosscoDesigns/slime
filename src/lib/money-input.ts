/**
 * Parsing operator-typed money.
 *
 * Separate from the admin server actions on purpose: a "use server" module may
 * only export async functions, so a synchronous helper cannot live there — and
 * this needs to be unit-testable without pulling in Stripe or next/headers.
 */

/**
 * Parse a dollars-and-cents string to cents. Null when it is not a clean
 * amount.
 *
 * Deliberately strict. This is the value an operator types to confirm a refund,
 * so anything ambiguous must be rejected rather than guessed at: "29.6" is
 * accepted as $29.60, but "29.634", "1e2" and "abc" are refused rather than
 * silently becoming some other number. Never Number() alone — Number("") is 0,
 * which would confirm a zero-dollar refund.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

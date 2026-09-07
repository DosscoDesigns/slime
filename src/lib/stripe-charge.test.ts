import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { resolveCharge } from "./stripe-charge";

/**
 * The live webhook endpoint is pinned to API version 2020-08-27, which
 * predates `latest_charge`. That version sends an embedded `charges.data[]`
 * instead. Everything customer-facing in the order email comes off the
 * charge, and the customer's BCC copy is addressed from it — so a null
 * charge means the customer gets nothing.
 *
 * This path has never executed in production (zero successful charges on the
 * live account as of 2026-09-05), so these tests are the only thing that has
 * ever exercised it.
 */

const charge = (id: string) => ({ id }) as unknown as Stripe.Charge;
const pi = (over: Record<string, unknown> = {}) =>
  ({ id: "pi_test", ...over }) as unknown as Stripe.PaymentIntent;

function stubStripe(over: Record<string, unknown> = {}) {
  return {
    charges: {
      retrieve: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    ...over,
  } as unknown as Stripe;
}

describe("resolveCharge", () => {
  it("uses an expanded latest_charge object without a round trip", async () => {
    const s = stubStripe();
    const expanded = charge("ch_expanded");

    expect(await resolveCharge(s, pi({ latest_charge: expanded }))).toBe(expanded);
    expect(s.charges.retrieve).not.toHaveBeenCalled();
  });

  it("retrieves latest_charge when it is a bare id", async () => {
    const fetched = charge("ch_fetched");
    const s = stubStripe();
    (s.charges.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(fetched);

    expect(await resolveCharge(s, pi({ latest_charge: "ch_fetched" }))).toBe(fetched);
    expect(s.charges.retrieve).toHaveBeenCalledWith("ch_fetched");
  });

  /** The 2020-08-27 shape. This is the one that actually runs in production. */
  it("falls back to the legacy embedded charges.data[] array", async () => {
    const legacy = charge("ch_legacy");
    const s = stubStripe();

    const got = await resolveCharge(s, pi({ charges: { data: [legacy] } }));

    expect(got).toBe(legacy);
    expect(s.charges.retrieve).not.toHaveBeenCalled();
    expect(s.charges.list).not.toHaveBeenCalled();
  });

  it("queries by payment_intent when the payload carries neither shape", async () => {
    const found = charge("ch_queried");
    const s = stubStripe();
    (s.charges.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [found] });

    expect(await resolveCharge(s, pi())).toBe(found);
    expect(s.charges.list).toHaveBeenCalledWith({
      payment_intent: "pi_test",
      limit: 1,
    });
  });

  it("prefers latest_charge over the legacy array when both are present", async () => {
    const modern = charge("ch_modern");
    const s = stubStripe();

    const got = await resolveCharge(
      s,
      pi({ latest_charge: modern, charges: { data: [charge("ch_legacy")] } })
    );

    expect(got).toBe(modern);
  });

  it("returns null rather than throwing when the lookup fails", async () => {
    const s = stubStripe();
    (s.charges.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("stripe down")
    );

    // Must not throw: the webhook has to stay in control of its own response.
    await expect(resolveCharge(s, pi())).resolves.toBeNull();
  });

  it("returns null on an empty legacy array instead of undefined", async () => {
    const s = stubStripe();
    expect(await resolveCharge(s, pi({ charges: { data: [] } }))).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { preparePatch, clampValue, patchOrderMetadata, MAX_VALUE_LENGTH } from "./order-metadata";

/**
 * These pin the behaviour that replaced the `{...retrieve().metadata, key}`
 * pattern. Stripe MERGES metadata on update, so re-sending a snapshot of every
 * other key bought nothing and created a window in which a concurrent write —
 * an inbound tracking update landing while a shipping email was being sent —
 * was silently reverted.
 */

describe("patchOrderMetadata", () => {
  it("sends ONLY the keys it was given, never a merged snapshot", async () => {
    const update = vi.fn().mockResolvedValue({});
    const stripe = { paymentIntents: { update } } as unknown as Stripe;

    await patchOrderMetadata(stripe, "pi_1", { trk_status: "transit" });

    expect(update).toHaveBeenCalledWith("pi_1", { metadata: { trk_status: "transit" } });
  });

  it("never reads the PaymentIntent first — there is nothing to race", async () => {
    const retrieve = vi.fn();
    const stripe = {
      paymentIntents: { update: vi.fn().mockResolvedValue({}), retrieve },
    } as unknown as Stripe;

    await patchOrderMetadata(stripe, "pi_1", { cancelled_at: "2026-09-09T00:00:00Z" });

    expect(retrieve).not.toHaveBeenCalled();
  });

  /** "" is how Stripe unsets one key, so un-cancelling must pass it through. */
  it("passes an empty string through so a key can be unset", async () => {
    const update = vi.fn().mockResolvedValue({});
    const stripe = { paymentIntents: { update } } as unknown as Stripe;

    await patchOrderMetadata(stripe, "pi_1", { cancelled_at: "", cancelled_reason: "" });

    expect(update).toHaveBeenCalledWith("pi_1", {
      metadata: { cancelled_at: "", cancelled_reason: "" },
    });
  });
});

describe("preparePatch", () => {
  /**
   * One oversized value 400s the WHOLE update, taking every other key with it.
   * A cancellation reason someone typed at length must not be able to prevent
   * the cancellation from being recorded.
   */
  it("truncates an over-long value rather than losing the write", () => {
    const long = "x".repeat(MAX_VALUE_LENGTH + 200);
    expect(preparePatch({ cancelled_reason: long }).cancelled_reason).toHaveLength(MAX_VALUE_LENGTH);
    expect(clampValue("short")).toBe("short");
  });

  /** An over-long KEY is a bug in our code, not bad data — truncating it would
   *  write to a different field, so it has to be loud. */
  it("throws on an over-long key instead of writing to the wrong field", () => {
    expect(() => preparePatch({ ["k".repeat(41)]: "v" })).toThrow(/over Stripe's limit/);
  });

  it("throws rather than silently dropping keys past Stripe's ceiling", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"])
    );
    expect(() => preparePatch(tooMany)).toThrow(/over Stripe's limit of 50/);
  });

  it("leaves an ordinary patch untouched", () => {
    expect(preparePatch({ trk_status: "delivered", trk_eta: "" })).toEqual({
      trk_status: "delivered",
      trk_eta: "",
    });
  });
});

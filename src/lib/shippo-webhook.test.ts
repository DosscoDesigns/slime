import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type Stripe from "stripe";
import { readTrigger, resolveOrderId, handleTrackUpdate } from "./shippo-webhook";
import type { TrackingSnapshot } from "./tracking";

/**
 * The tracking webhook's threat model in test form.
 *
 * Shippo's only self-serve authentication is a token in the URL, which is a
 * weak secret that lands in request logs. The design compensates by treating
 * the payload as a TRIGGER rather than as data: we take the tracking number
 * from it and re-fetch the truth with our own API key. These tests pin that
 * property — most importantly that nothing from the body is ever written.
 */

function snapshot(over: Partial<TrackingSnapshot> = {}): TrackingSnapshot {
  return {
    status: "delivered",
    statusDetail: "Delivered",
    statusAt: new Date("2026-09-11T16:04:00Z"),
    etaAt: null,
    transitStartedAt: new Date("2026-09-09T02:11:00Z"),
    deliveredAt: new Date("2026-09-11T16:04:00Z"),
    orderRef: "pi_3ABCdef123456789",
    ...over,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** The Track object Shippo returns from GET /tracks/{carrier}/{number}. */
function trackResponse(over: Record<string, unknown> = {}) {
  return json({
    carrier: "usps",
    tracking_number: "9205590164917312751089",
    metadata: "pi_3ABCdef123456789",
    tracking_status: { status: "DELIVERED", status_details: "Delivered", status_date: "2026-09-11T16:04:00Z" },
    tracking_history: [
      { status: "TRANSIT", status_date: "2026-09-09T02:11:00Z" },
      { status: "DELIVERED", status_date: "2026-09-11T16:04:00Z" },
    ],
    ...over,
  });
}

describe("readTrigger", () => {
  it("accepts the Track posted bare and wrapped in {event, data}", () => {
    const bare = readTrigger({ carrier: "usps", tracking_number: "9205590164917312751089" });
    const wrapped = readTrigger({
      event: "track_updated",
      data: { carrier: "usps", tracking_number: "9205590164917312751089" },
    });
    expect(bare?.trackingNumber).toBe("9205590164917312751089");
    expect(wrapped?.trackingNumber).toBe("9205590164917312751089");
  });

  it("keeps the shippo carrier token the test-mode numbers use", () => {
    expect(readTrigger({ carrier: "shippo", tracking_number: "SHIPPO_DELIVERED" })?.carrier).toBe("shippo");
  });

  it("refuses a payload with no usable tracking number", () => {
    expect(readTrigger(null)).toBeNull();
    expect(readTrigger({})).toBeNull();
    expect(readTrigger({ tracking_number: "" })).toBeNull();
    expect(readTrigger({ tracking_number: "../../evil" })).toBeNull();
    expect(readTrigger({ tracking_number: "x' OR '1'='1" })).toBeNull();
  });
});

describe("resolveOrderId", () => {
  it("uses the reference we stamped at purchase, with no lookup at all", async () => {
    const search = vi.fn();
    const stripe = { paymentIntents: { search } } as unknown as Stripe;

    const id = await resolveOrderId(stripe, snapshot(), "9205590164917312751089");

    expect(id).toBe("pi_3ABCdef123456789");
    expect(search).not.toHaveBeenCalled();
  });

  /**
   * The fallback exists for labels bought before the reference was recorded.
   * It is a fallback because Stripe's search index is eventually consistent —
   * a PRE_TRANSIT event can fire before the tracking number is indexed.
   */
  it("falls back to a Stripe search when no reference came back", async () => {
    const search = vi.fn().mockResolvedValue({ data: [{ id: "pi_found" }] });
    const stripe = { paymentIntents: { search } } as unknown as Stripe;

    const id = await resolveOrderId(stripe, snapshot({ orderRef: null }), "9205590164917312751089");

    expect(id).toBe("pi_found");
  });

  /** An attacker-supplied "reference" must not be trusted into a query. */
  it("ignores a reference that is not a PaymentIntent id", async () => {
    const search = vi.fn().mockResolvedValue({ data: [] });
    const stripe = { paymentIntents: { search } } as unknown as Stripe;

    const id = await resolveOrderId(
      stripe,
      snapshot({ orderRef: "' OR 1=1 --" }),
      "9205590164917312751089"
    );

    expect(id).toBeNull();
    // It fell through to the search rather than using the bogus reference.
    expect(search).toHaveBeenCalledOnce();
  });

  it("returns null instead of throwing when the search fails", async () => {
    const stripe = {
      paymentIntents: { search: vi.fn().mockRejectedValue(new Error("stripe down")) },
    } as unknown as Stripe;

    await expect(
      resolveOrderId(stripe, snapshot({ orderRef: null }), "9205590164917312751089")
    ).resolves.toBeNull();
  });
});

describe("handleTrackUpdate", () => {
  beforeEach(() => {
    process.env.SHIPPO_API_KEY = "shippo_test_key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SHIPPO_API_KEY;
  });

  it("writes what Shippo returned, never what the payload claimed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(trackResponse()));
    const update = vi.fn().mockResolvedValue({});
    const stripe = { paymentIntents: { update, search: vi.fn() } } as unknown as Stripe;

    // A forged body claiming the parcel is delivered, with a bogus order id.
    const result = await handleTrackUpdate(stripe, {
      carrier: "usps",
      tracking_number: "9205590164917312751089",
      metadata: "pi_ATTACKER",
      tracking_status: { status: "RETURNED", status_date: "1999-01-01T00:00:00Z" },
    });

    expect(result.handled).toBe(true);
    // The order id and the status both came from the re-fetch, not the body.
    expect(update).toHaveBeenCalledWith("pi_3ABCdef123456789", {
      metadata: expect.objectContaining({
        trk_status: "delivered",
        trk_delivered_at: "2026-09-11T16:04:00.000Z",
        trk_transit_at: "2026-09-09T02:11:00.000Z",
      }),
    });
  });

  it("does nothing, quietly, for a tracking number this deploy never saw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(trackResponse({ metadata: "" })));
    const update = vi.fn();
    const stripe = {
      paymentIntents: { update, search: vi.fn().mockResolvedValue({ data: [] }) },
    } as unknown as Stripe;

    const result = await handleTrackUpdate(stripe, {
      carrier: "usps",
      tracking_number: "9205590164917312751089",
    });

    // Not an error: another environment's label, a test label, a stale
    // registration. The route still answers 200 so Shippo does not retry.
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("no matching order");
    expect(update).not.toHaveBeenCalled();
  });

  it("gives up without writing when Shippo cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const update = vi.fn();
    const stripe = { paymentIntents: { update, search: vi.fn() } } as unknown as Stripe;

    const result = await handleTrackUpdate(stripe, {
      carrier: "usps",
      tracking_number: "9205590164917312751089",
    });

    expect(result.handled).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("ignores a payload with nothing trackable in it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const stripe = { paymentIntents: { update: vi.fn() } } as unknown as Stripe;

    const result = await handleTrackUpdate(stripe, { hello: "world" });

    expect(result.handled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

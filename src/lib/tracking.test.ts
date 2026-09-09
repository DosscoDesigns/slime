import { describe, it, expect } from "vitest";
import { parseTrack, isTerminal, isValidTrackingNumber } from "./tracking";

/**
 * These pin the mapping from Shippo's Track object, which is the only place
 * delivery timing comes from. The fixture shape is copied from Shippo's
 * OpenAPI spec (tracking_status / tracking_history / eta, six status values),
 * not invented — a mapping tested against a made-up shape proves nothing.
 */

function track(over: Record<string, unknown> = {}) {
  return {
    carrier: "usps",
    tracking_number: "9205590164917312751089",
    eta: "2026-09-12T00:00:00Z",
    metadata: "pi_3ABCdef123456789",
    tracking_status: {
      status: "DELIVERED",
      status_details: "Your shipment has been delivered at the destination mailbox.",
      status_date: "2026-09-11T16:04:00Z",
    },
    tracking_history: [
      // USPS emits this the moment the label is created, dated at creation.
      { status: "PRE_TRANSIT", status_details: "Shipping Label Created", status_date: "2026-09-08T18:00:00Z" },
      { status: "TRANSIT", status_details: "Accepted at USPS Origin Facility", status_date: "2026-09-09T02:11:00Z" },
      { status: "TRANSIT", status_details: "In Transit to Next Facility", status_date: "2026-09-10T09:30:00Z" },
      { status: "DELIVERED", status_details: "Delivered", status_date: "2026-09-11T16:04:00Z" },
    ],
    ...over,
  };
}

describe("parseTrack", () => {
  it("reads the latest status, detail and carrier scan time", () => {
    const s = parseTrack(track());
    expect(s.status).toBe("delivered");
    expect(s.statusDetail).toContain("delivered at the destination mailbox");
    expect(s.statusAt?.toISOString()).toBe("2026-09-11T16:04:00.000Z");
    expect(s.etaAt?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  /**
   * The one that matters for the delivery numbers. Measuring from PRE_TRANSIT
   * would silently turn carrier transit time into total time, because USPS
   * dates "Shipping Label Created" at label creation — hours or days before it
   * physically has the parcel.
   */
  it("starts transit at the FIRST real carrier scan, never at PRE_TRANSIT", () => {
    const s = parseTrack(track());
    expect(s.transitStartedAt?.toISOString()).toBe("2026-09-09T02:11:00.000Z");
  });

  it("takes the delivery time from the DELIVERED history entry", () => {
    const s = parseTrack(track());
    expect(s.deliveredAt?.toISOString()).toBe("2026-09-11T16:04:00.000Z");
  });

  /** History is documented earliest-first, but nothing here leans on that. */
  it("finds the same scans when history comes back in any order", () => {
    const reversed = track({ tracking_history: [...track().tracking_history].reverse() });
    const s = parseTrack(reversed);
    expect(s.transitStartedAt?.toISOString()).toBe("2026-09-09T02:11:00.000Z");
    expect(s.deliveredAt?.toISOString()).toBe("2026-09-11T16:04:00.000Z");
  });

  it("carries the order reference we stamped on the Shippo transaction", () => {
    expect(parseTrack(track()).orderRef).toBe("pi_3ABCdef123456789");
  });

  it("reports no transit start when the carrier never scanned it", () => {
    const s = parseTrack(
      track({
        tracking_status: { status: "PRE_TRANSIT", status_details: "Label created", status_date: "2026-09-08T18:00:00Z" },
        tracking_history: [{ status: "PRE_TRANSIT", status_date: "2026-09-08T18:00:00Z" }],
      })
    );
    expect(s.status).toBe("pre_transit");
    expect(s.transitStartedAt).toBeNull();
    expect(s.deliveredAt).toBeNull();
  });

  /** A delivered parcel whose delivery scan has aged out of the history. */
  it("falls back to the status date when history has no DELIVERED entry", () => {
    const s = parseTrack(track({ tracking_history: [] }));
    expect(s.deliveredAt?.toISOString()).toBe("2026-09-11T16:04:00.000Z");
  });

  it("survives malformed dates and a missing payload without throwing", () => {
    const s = parseTrack(
      track({
        eta: "not-a-date",
        tracking_status: { status: "TRANSIT", status_date: "nonsense" },
        tracking_history: [{ status: "TRANSIT", status_date: "also-nonsense" }],
      })
    );
    expect(s.status).toBe("transit");
    expect(s.statusAt).toBeNull();
    expect(s.etaAt).toBeNull();
    expect(s.transitStartedAt).toBeNull();

    expect(parseTrack(null).status).toBe("unknown");
    expect(parseTrack({}).status).toBe("unknown");
  });

  it("maps an unrecognised carrier status to unknown rather than trusting it", () => {
    expect(parseTrack(track({ tracking_status: { status: "SOMETHING_NEW" } })).status).toBe("unknown");
  });
});

describe("isTerminal", () => {
  /**
   * RETURNED and FAILURE are terminal in the same sense DELIVERED is — the
   * parcel stopped moving — but they are failures, so they must stay visible
   * rather than being folded into "done".
   */
  it("treats returned and failed as terminal, not just delivered", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("returned")).toBe(true);
    expect(isTerminal("failure")).toBe(true);
    expect(isTerminal("transit")).toBe(false);
    expect(isTerminal("pre_transit")).toBe(false);
    expect(isTerminal("unknown")).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });
});

describe("isValidTrackingNumber", () => {
  /** These values reach a URL path and a Stripe search query. */
  it("accepts real numbers and the Shippo test tokens, rejects junk", () => {
    expect(isValidTrackingNumber("9205590164917312751089")).toBe(true);
    expect(isValidTrackingNumber("SHIPPO_DELIVERED")).toBe(true);
    expect(isValidTrackingNumber("1Z999AA10123456784")).toBe(true);
    expect(isValidTrackingNumber("")).toBe(false);
    expect(isValidTrackingNumber("short")).toBe(false);
    expect(isValidTrackingNumber("../../etc/passwd")).toBe(false);
    expect(isValidTrackingNumber("abc' OR '1'='1")).toBe(false);
  });
});

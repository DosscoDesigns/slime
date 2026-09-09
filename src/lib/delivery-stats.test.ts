import { describe, it, expect } from "vitest";
import { orderDurations, deliveryStats, median, formatDuration } from "./delivery-stats";
import type { Order } from "./orders";

/**
 * The delivery numbers exist to answer "is the delay ours or the carrier's?",
 * so the split between handling and transit is the whole point. These pin that
 * split, and pin medians over means — at the volume this store runs at, one
 * stuck parcel would drag an average somewhere useless.
 */

function order(over: Partial<Order> = {}): Order {
  return {
    id: "pi_1",
    createdAt: new Date("2026-09-08T12:00:00Z"),
    labelBoughtAt: new Date("2026-09-09T12:00:00Z"), // 24h handling
    tracking: {
      number: "9205590164917312751089",
      carrier: "usps",
      url: "https://example.test",
      status: "delivered",
      statusAt: new Date("2026-09-12T12:00:00Z"),
      etaAt: null,
      transitStartedAt: new Date("2026-09-10T12:00:00Z"),
      deliveredAt: new Date("2026-09-12T12:00:00Z"), // 48h transit, 96h total
    },
    ...over,
  } as Order;
}

describe("orderDurations", () => {
  it("separates our handling from the carrier's transit", () => {
    const d = orderDurations(order());
    expect(d.handlingHours).toBe(24);
    expect(d.transitHours).toBe(48);
    expect(d.totalHours).toBe(96);
  });

  it("reports nulls rather than guesses when a timestamp is missing", () => {
    const d = orderDurations(order({ labelBoughtAt: null }));
    expect(d.handlingHours).toBeNull();
    // Total does not depend on when we bought the label, so it survives.
    expect(d.totalHours).toBe(96);
  });

  it("has no duration at all for an undelivered order", () => {
    const d = orderDurations(
      order({
        tracking: { ...order().tracking!, status: "transit", deliveredAt: null },
      })
    );
    expect(d.transitHours).toBeNull();
    expect(d.totalHours).toBeNull();
    expect(d.handlingHours).toBe(24);
  });

  /** A carrier backdating a scan must not produce a negative average. */
  it("drops impossible negative spans", () => {
    const d = orderDurations(
      order({ labelBoughtAt: new Date("2026-09-07T12:00:00Z") })
    );
    expect(d.handlingHours).toBeNull();
  });

  it("is null everywhere for an order with no tracking", () => {
    const d = orderDurations(order({ tracking: null }));
    expect(d.transitHours).toBeNull();
    expect(d.totalHours).toBeNull();
  });
});

describe("median", () => {
  it("takes the middle value, averaging the two middles when even", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("deliveryStats", () => {
  it("counts only delivered orders and reports a median, not a mean", () => {
    const fast = order({ id: "pi_fast" });
    const alsoFast = order({ id: "pi_fast2" });
    // One parcel stuck for 40 days. A mean would be ~330h; the median must not move.
    const stuck = order({
      id: "pi_stuck",
      tracking: {
        ...order().tracking!,
        deliveredAt: new Date("2026-10-18T12:00:00Z"),
      },
    });
    const undelivered = order({
      id: "pi_open",
      tracking: { ...order().tracking!, status: "transit", deliveredAt: null },
    });

    const s = deliveryStats([fast, alsoFast, stuck, undelivered]);
    expect(s.n).toBe(3);
    expect(s.medianTotalHours).toBe(96);
    expect(s.medianHandlingHours).toBe(24);
    expect(s.slowest?.orderId).toBe("pi_stuck");
  });

  it("reports an empty sample rather than zeroes when nothing has arrived", () => {
    const s = deliveryStats([
      order({ tracking: { ...order().tracking!, deliveredAt: null } }),
    ]);
    expect(s.n).toBe(0);
    expect(s.medianTotalHours).toBeNull();
    expect(s.slowest).toBeNull();
  });
});

describe("formatDuration", () => {
  it("uses hours below two days and days above, and never prints a fake zero", () => {
    expect(formatDuration(18)).toBe("18 hr");
    expect(formatDuration(96)).toBe("4.0 days");
    expect(formatDuration(null)).toBe("—");
  });
});

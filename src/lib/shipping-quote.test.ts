import { describe, expect, it } from "vitest";
import {
  buildOptions,
  decodeOptions,
  encodeOptions,
  fallbackOptions,
  isPoBox,
  parcelForCart,
  quoteKey,
  selectOption,
} from "./shipping-quote";
import {
  ACCESSORY_BOX,
  HANDLING_CENTS,
  KIT_BOX,
  SHIPPING_FALLBACK_CENTS,
} from "./shipping-config";
import { SHIPPING_FREE_THRESHOLD_CENTS } from "./pricing";
import type { Rate } from "./shipping";

const rate = (serviceToken: string, amountCents: number, estimatedDays = 3): Rate => ({
  id: serviceToken,
  provider: serviceToken.startsWith("ups") ? "UPS" : "USPS",
  service: serviceToken,
  serviceToken,
  amountCents,
  estimatedDays,
});

// Real Pittsburgh quote for the kit box, 2026-11-25, plus noise we don't offer.
const RATES = [
  rate("ups_ground", 742, 2),
  rate("ups_ground_saver", 742, 3),
  rate("usps_ground_advantage", 743),
  rate("usps_priority", 1150),
  rate("ups_second_day_air", 1390, 2),
  rate("ups_next_day_air", 5593, 1),
];

describe("parcelForCart", () => {
  it("puts a single kit in the kit box with the box's weight added", () => {
    const p = parcelForCart([{ id: "k", quantity: 1, gallons: 20 }]);
    expect(p.boxId).toBe(KIT_BOX.id);
    expect(p.lengthIn).toBe(KIT_BOX.lengthIn);
    // 20G was weighed at 15.6 oz packed.
    expect(p.weightLb).toBeCloseTo(15.6 / 16, 1);
  });

  it("moves anything with add-ons to the accessory box", () => {
    const p = parcelForCart([
      { id: "k", quantity: 1, gallons: 40, addons: [{ id: "mixer", name: "m", priceCents: 0, quantity: 1 }] },
    ]);
    expect(p.boxId).toBe(ACCESSORY_BOX.id);
  });

  it("reproduces the real 2026-11-21 accessories order (5.2 lb)", () => {
    const p = parcelForCart([
      {
        id: "k",
        quantity: 1,
        gallons: 40,
        addons: [
          { id: "mixer", name: "m", priceCents: 0, quantity: 1 },
          { id: "goggles", name: "g", priceCents: 0, quantity: 10 },
          { id: "sprayers", name: "s", priceCents: 0, quantity: 10 },
        ],
      },
    ]);
    expect(p.weightLb).toBeCloseTo(5.2, 1);
  });

  it("moves more pouches than the kit box holds to the bigger box", () => {
    expect(parcelForCart([{ id: "k", quantity: 2, gallons: 80 }]).boxId).toBe(ACCESSORY_BOX.id);
    expect(parcelForCart([{ id: "k", quantity: 1, gallons: 80 }]).boxId).toBe(KIT_BOX.id);
  });
});

describe("buildOptions", () => {
  it("offers the configured services, cheapest UPS first, with handling added", () => {
    const opts = buildOptions(RATES, 4999);
    expect(opts.map((o) => o.id)).toEqual(["ups-ground", "usps-ground", "usps-priority", "ups-2day"]);
    expect(opts[0].cents).toBe(742 + HANDLING_CENTS);
    expect(opts[0].carrierCents).toBe(742);
    // Next-day isn't a configured option.
    expect(opts.some((o) => o.token === "ups_next_day_air")).toBe(false);
  });

  it("picks the cheaper of UPS Ground and Ground Saver", () => {
    const opts = buildOptions([rate("ups_ground", 1660), rate("ups_ground_saver", 1782)], 4999);
    expect(opts[0].token).toBe("ups_ground");
    expect(opts[0].carrierCents).toBe(1660);
  });

  it("makes the default free over the threshold and charges upgrades the difference", () => {
    const opts = buildOptions(RATES, SHIPPING_FREE_THRESHOLD_CENTS);
    expect(opts[0].cents).toBe(0);
    expect(opts.find((o) => o.id === "usps-priority")!.cents).toBe(1150 - 742);
    expect(opts.every((o) => o.cents >= 0)).toBe(true);
  });

  it("drops UPS for a PO box, and the first USPS option becomes the default", () => {
    const opts = buildOptions(RATES, 4999, { poBox: true });
    expect(opts.every((o) => !o.token.startsWith("ups_"))).toBe(true);
    expect(opts[0].id).toBe("usps-ground");
  });

  it("returns nothing when no configured service was quoted", () => {
    expect(buildOptions([rate("ups_next_day_air", 5593)], 4999)).toEqual([]);
  });
});

describe("fallback and selection", () => {
  it("falls back to the flat rate, free over the threshold", () => {
    expect(fallbackOptions(4999)[0].cents).toBe(SHIPPING_FALLBACK_CENTS);
    expect(fallbackOptions(SHIPPING_FREE_THRESHOLD_CENTS)[0].cents).toBe(0);
  });

  it("honours a known option id and ignores an unknown one", () => {
    const opts = buildOptions(RATES, 4999);
    expect(selectOption(opts, "usps-priority").id).toBe("usps-priority");
    expect(selectOption(opts, "free-please").id).toBe("ups-ground");
    expect(selectOption(opts, undefined).id).toBe("ups-ground");
  });
});

describe("caching helpers", () => {
  it("round-trips options through metadata, under Stripe's 500-char limit", () => {
    const opts = buildOptions(RATES, 4999);
    const raw = encodeOptions(opts);
    expect(raw.length).toBeLessThan(500);
    expect(decodeOptions(raw)).toEqual(opts);
    expect(decodeOptions("not json")).toBeNull();
  });

  it("keys the quote on address and parcel, ignoring case and ZIP+4", () => {
    const p = parcelForCart([{ id: "k", quantity: 1, gallons: 40 }]);
    const a = quoteKey({ line1: "5000 Forbes Ave", city: "Pittsburgh", state: "PA", postal_code: "15213" }, p);
    const b = quoteKey({ line1: "5000  forbes ave", city: "PITTSBURGH", state: "pa", postal_code: "15213-3890" }, p);
    expect(a).toBe(b);
  });

  it("recognises PO boxes", () => {
    expect(isPoBox({ line1: "PO Box 12" })).toBe(true);
    expect(isPoBox({ line1: "P.O. Box 12" })).toBe(true);
    expect(isPoBox({ line2: "post office box 9" })).toBe(true);
    expect(isPoBox({ line1: "12 Boxwood Ln" })).toBe(false);
  });
});

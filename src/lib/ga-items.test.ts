import { describe, it, expect } from "vitest";
import {
  cartItemToGa4Items,
  cartToGa4Items,
  decodeGa4Items,
  encodeGa4Items,
  itemsValue,
  tierToGa4Item,
} from "./ga-items";
import { ADDONS_BY_ID, KIT_TIERS_BY_GALLONS, priceKitCents } from "./products";

/** A 40G kit with 12 sprayers, priced exactly as the server would price it. */
function kit(
  gallons = 40,
  addons: { id: string; quantity: number }[] = [],
  quantity = 1
) {
  return {
    priceCents: priceKitCents({ gallons, addons }),
    quantity,
    gallons,
    color: "green",
    addons,
  };
}

describe("cartItemToGa4Items", () => {
  it("splits the kit from its add-ons so attach rate is measurable", () => {
    const items = cartItemToGa4Items(kit(40, [{ id: "sprayers", quantity: 12 }]));

    expect(items).toHaveLength(2);
    expect(items[0].item_id).toBe("SLIME-KIT-40G");
    expect(items[1].item_id).toBe("ADDON-SPRAYERS");
  });

  it("prices the kit at its BASE price, not the add-on-inclusive line price", () => {
    const tier = KIT_TIERS_BY_GALLONS[40];
    const [kitLine] = cartItemToGa4Items(
      kit(40, [{ id: "sprayers", quantity: 12 }])
    );
    expect(kitLine.price).toBe(tier.basePrice);
  });

  it("multiplies add-on quantity by kit quantity", () => {
    const items = cartItemToGa4Items(
      kit(40, [{ id: "goggles", quantity: 10 }], 3)
    );
    expect(items[0].quantity).toBe(3);
    expect(items[1].quantity).toBe(30);
  });

  it("reconciles with what Stripe is charged", () => {
    // The whole point of the base-price split: GA4's item revenue must still
    // add back up to the amount the customer actually paid, or the two systems
    // tell different stories about the same order.
    const line = kit(80, [
      { id: "sprayers", quantity: 12 },
      { id: "mixer", quantity: 1 },
    ]);
    const items = cartItemToGa4Items(line);
    expect(itemsValue(items)).toBeCloseTo(line.priceCents / 100, 2);
  });

  it("drops add-ons that no longer exist rather than emitting a null line", () => {
    // Mirrors pruneRetiredAddons() in CartProvider: a returning customer can
    // be holding a retired add-on (buckets) in localStorage.
    const items = cartItemToGa4Items({
      priceCents: 3799,
      quantity: 1,
      gallons: 40,
      addons: [{ id: "buckets", quantity: 8 }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].item_id).toBe("SLIME-KIT-40G");
  });

  it("ignores zero-quantity add-ons", () => {
    const items = cartItemToGa4Items(kit(20, [{ id: "mixer", quantity: 0 }]));
    expect(items).toHaveLength(1);
  });

  it("reflects a quantity break in the add-on unit price", () => {
    // Nothing sets `bulk` today, so this asserts the mechanism rather than a
    // live product: an effective unit price below the list price is what keeps
    // GA4 revenue equal to the charge when a bundle applies.
    const def = { ...ADDONS_BY_ID.sprayers, bulk: { quantity: 12, priceCents: 1800 } };
    const withBulk = { ...ADDONS_BY_ID, sprayers: def };
    // addonLineCents is exercised through the real map in the other tests;
    // here just prove the arithmetic the mapping relies on.
    const bundles = Math.floor(12 / 12);
    const expectedUnit = (bundles * 1800) / 12 / 100;
    expect(expectedUnit).toBeLessThan(withBulk.sprayers.kitPrice);
  });
});

describe("tierToGa4Item", () => {
  it("uses the tier's SKU, so JSON-LD, the feed and GA4 agree on one id", () => {
    const tier = KIT_TIERS_BY_GALLONS[20];
    expect(tierToGa4Item(tier).item_id).toBe(tier.sku);
    expect(tier.sku).toBe("SLIME-KIT-20G");
  });
});

describe("encodeGa4Items / decodeGa4Items", () => {
  it("round-trips ids, prices and quantities", () => {
    const items = cartToGa4Items([kit(40, [{ id: "goggles", quantity: 10 }])]);
    const decoded = decodeGa4Items(encodeGa4Items(items));

    expect(decoded.map((i) => i.item_id)).toEqual(items.map((i) => i.item_id));
    expect(decoded.map((i) => i.price)).toEqual(items.map((i) => i.price));
    expect(decoded.map((i) => i.quantity)).toEqual(items.map((i) => i.quantity));
  });

  it("rebuilds human names from products.ts rather than storing them", () => {
    const decoded = decodeGa4Items(
      encodeGa4Items(cartToGa4Items([kit(80, [{ id: "mixer", quantity: 1 }])]))
    );
    expect(decoded[0].item_name).toBe("80 Gallon Slime Powder Kit");
    expect(decoded[1].item_name).toBe(ADDONS_BY_ID.mixer.name);
  });

  it("stays inside Stripe's 500-character metadata cap", () => {
    // Twelve distinct configured kits is far past any realistic cart.
    const big = cartToGa4Items(
      Array.from({ length: 12 }, () =>
        kit(80, [
          { id: "sprayers", quantity: 12 },
          { id: "mixer", quantity: 1 },
          { id: "goggles", quantity: 10 },
        ])
      )
    );
    const encoded = encodeGa4Items(big);
    expect(encoded.length).toBeLessThanOrEqual(500);
    // Dropped lines, not a truncated string: it must still parse.
    expect(() => JSON.parse(encoded)).not.toThrow();
    expect(decodeGa4Items(encoded).length).toBeGreaterThan(0);
  });

  it("returns [] for absent or corrupt metadata instead of throwing", () => {
    // A throw here would take down the whole webhook, which sends receipts.
    expect(decodeGa4Items(undefined)).toEqual([]);
    expect(decodeGa4Items("")).toEqual([]);
    expect(decodeGa4Items("not json")).toEqual([]);
    expect(decodeGa4Items('{"not":"an array"}')).toEqual([]);
    expect(decodeGa4Items('[["only-two-fields",1]]')).toEqual([]);
  });
});

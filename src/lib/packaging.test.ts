import { describe, it, expect } from "vitest";
import { PACK_VARIANTS, usage, remaining, feasible, suggestPlans, pouchesPerKit } from "./packaging";

const byId = (id: string) => PACK_VARIANTS.find((v) => v.id === id)!;

describe("variants", () => {
  it("covers multi + four colors at three sizes", () => {
    expect(PACK_VARIANTS).toHaveLength(15);
  });

  it("uses 4/8/16 pouches for 20/40/80 gallons", () => {
    expect(pouchesPerKit(byId("multi-20"))).toBe(4);
    expect(pouchesPerKit(byId("blue-40"))).toBe(8);
    expect(pouchesPerKit(byId("red-80"))).toBe(16);
  });

  it("splits a multi kit evenly and puts a single-color kit on one color", () => {
    expect(usage(byId("multi-40"))).toEqual({ red: 2, yellow: 2, green: 2, blue: 2 });
    expect(usage(byId("yellow-20"))).toEqual({ red: 0, yellow: 4, green: 0, blue: 0 });
  });

  it("has an FNSKU for every variant", () => {
    expect(PACK_VARIANTS.filter((v) => !v.fnsku).map((v) => v.id)).toEqual([]);
    expect(byId("blue-20").fnsku).toBe("X005FGMKGR");
    expect(byId("multi-20").fnsku).toBe("X0055YOG1L");
  });
});

describe("remaining / feasible", () => {
  const onHand = { red: 10, yellow: 10, green: 10, blue: 6 };

  it("subtracts every kit's pouches", () => {
    expect(remaining(onHand, { "multi-20": 2, "red-20": 1 })).toEqual({
      red: 4,
      yellow: 8,
      green: 8,
      blue: 4,
    });
  });

  it("rejects a plan that needs more of a color than is on hand", () => {
    expect(feasible(onHand, { "multi-20": 6 })).toBe(true);
    expect(feasible(onHand, { "multi-20": 7 })).toBe(false);
  });
});

describe("suggestPlans", () => {
  const onHand = { red: 37, yellow: 41, green: 36, blue: 29 };

  it("every suggestion is feasible, labelled, and never an 80", () => {
    for (const o of suggestPlans(onHand)) {
      expect(feasible(onHand, o.plan)).toBe(true);
      expect(remaining(onHand, o.plan)).toEqual(o.leftover);
      for (const id of Object.keys(o.plan)) {
        const v = byId(id);
        expect(v.gallons).not.toBe(80);
        expect(v.fnsku).toBeTruthy();
      }
    }
  });

  it("evening out stock leaves no kit's worth unused and fills the thinnest listing first", () => {
    const [even] = suggestPlans(onHand, { "multi-20": 26, "multi-40": 10 });
    // A multi-20 takes one of each color, so nothing should be stranded while all four remain.
    expect(Math.min(...Object.values(even.leftover))).toBe(0);
    expect(even.plan["multi-20"] ?? 0).toBeLessThan(even.plan["red-20"] ?? 0);
  });

  it("puts about 80% of a color's pouches into 40-gal kits when it has a 40 listing", () => {
    const o = suggestPlans(onHand).find((x) => x.label.startsWith("~80%"))!;
    // Red has a 40-gal single; blue only reaches 40s through the multi.
    const pouches = (g: number) =>
      Object.entries(o.plan)
        .filter(([id]) => byId(id).gallons === g)
        .reduce((s, [id, n]) => s + n * usage(byId(id)).red, 0);
    const share = pouches(40) / (pouches(40) + pouches(20));
    expect(share).toBeGreaterThan(0.7);
    expect(share).toBeLessThan(0.9);
  });

  it("maxes out the multi kit by the scarcest color", () => {
    const twenty = suggestPlans({ red: 12, yellow: 12, green: 12, blue: 5 }).find((x) =>
      x.label.startsWith("Max 20")
    )!;
    expect(twenty.plan["multi-20"]).toBe(5);
    expect(twenty.plan["red-20"]).toBe(1);
  });
});

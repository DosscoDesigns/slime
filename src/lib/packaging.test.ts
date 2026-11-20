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

  it("has no FNSKU for a listing that is not set to FBA yet", () => {
    expect(byId("blue-20").fnsku).toBeNull();
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
  it("every suggestion is feasible and leaves less than one kit of any color", () => {
    const onHand = { red: 37, yellow: 41, green: 36, blue: 29 };
    for (const o of suggestPlans(onHand)) {
      expect(feasible(onHand, o.plan)).toBe(true);
      expect(remaining(onHand, o.plan)).toEqual(o.leftover);
      for (const c of ["red", "yellow", "green", "blue"] as const) {
        expect(o.leftover[c]).toBeLessThan(4);
      }
    }
  });

  it("maxes out the multi kit by the scarcest color", () => {
    const [twenty] = suggestPlans({ red: 12, yellow: 12, green: 12, blue: 5 });
    expect(twenty.plan["multi-20"]).toBe(5);
    expect(twenty.plan["red-20"]).toBe(1);
  });
});

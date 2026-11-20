import { describe, it, expect } from "vitest";
import {
  planBatch,
  formatSpoons,
  inconsistentColors,
  BatchInputError,
  GRAMS_PER_LB,
  type Recipe,
} from "./manufacturing";
import { parseRecipe, RecipeConfigError } from "./recipe";

// DELIBERATELY FAKE. The real recipe is a trade secret and must never be
// committed — these numbers only exercise the math.
const FAKE: Recipe = {
  polyGrams: 1000,
  maltoGrams: 500,
  colors: {
    red: { tbspPerBatch: 2, tspPerPouch: 0.5 },
    yellow: { tbspPerBatch: 2, tspPerPouch: 0.5 },
    green: { tbspPerBatch: 2, tspPerPouch: 0.5 },
    blue: { tbspPerBatch: 1, tspPerPouch: 0.25 },
  },
};

describe("planBatch", () => {
  it("splits the base evenly across colors and keeps poly:malto fixed", () => {
    const plan = planBatch(FAKE, {
      amountLb: 4000 / GRAMS_PER_LB,
      base: "poly",
      colors: ["red", "yellow", "green", "blue"],
    });
    expect(plan.perColor).toHaveLength(4);
    for (const p of plan.perColor) {
      expect(p.polyGrams).toBeCloseTo(1000);
      expect(p.maltoGrams).toBeCloseTo(500);
      expect(p.batchFactor).toBeCloseTo(1);
    }
    expect(plan.totals.polyGrams).toBeCloseTo(4000);
  });

  it("scales colorant and pouches with the batch factor", () => {
    const plan = planBatch(FAKE, {
      amountLb: 2000 / GRAMS_PER_LB,
      base: "poly",
      colors: ["red"],
    });
    const red = plan.perColor[0];
    expect(red.batchFactor).toBeCloseTo(2);
    expect(red.colorantTsp).toBeCloseTo(12);
    expect(red.pouches).toBe(24);
  });

  it("starts from malto when malto is the ingredient on hand", () => {
    const plan = planBatch(FAKE, {
      amountLb: 500 / GRAMS_PER_LB,
      base: "malto",
      colors: ["blue"],
    });
    expect(plan.perColor[0].polyGrams).toBeCloseTo(1000);
  });

  it("returns colors in a fixed order regardless of input order", () => {
    const plan = planBatch(FAKE, { amountLb: 1, base: "poly", colors: ["blue", "red"] });
    expect(plan.perColor.map((p) => p.color)).toEqual(["red", "blue"]);
  });

  it("rejects an empty amount or no colors", () => {
    expect(() => planBatch(FAKE, { amountLb: 0, base: "poly", colors: ["red"] })).toThrow(
      BatchInputError
    );
    expect(() => planBatch(FAKE, { amountLb: 5, base: "poly", colors: [] })).toThrow(
      BatchInputError
    );
  });
});

describe("formatSpoons", () => {
  it.each([
    [0.125, "⅛ tsp"],
    [0.25, "¼ tsp"],
    [3, "1 T"],
    [4.5, "1 T + 1½ tsp"],
    [7.375, "2 T + 1⅜ tsp"],
    [0.01, "0 tsp"],
  ])("%s tsp → %s", (tsp, out) => {
    expect(formatSpoons(tsp)).toBe(out);
  });
});

describe("inconsistentColors", () => {
  it("is empty when every color implies the same pouch count", () => {
    expect(inconsistentColors(FAKE)).toEqual([]);
  });

  it("flags the odd one out", () => {
    const off: Recipe = {
      ...FAKE,
      colors: { ...FAKE.colors, yellow: { tbspPerBatch: 6, tspPerPouch: 0.5 } },
    };
    expect(inconsistentColors(off)).toEqual(["yellow"]);
  });
});

describe("parseRecipe", () => {
  it("round-trips a valid recipe", () => {
    expect(parseRecipe(JSON.stringify(FAKE))).toEqual(FAKE);
  });

  it("fails closed, naming the field but never the value", () => {
    expect(() => parseRecipe(undefined)).toThrow(RecipeConfigError);
    expect(() => parseRecipe("{")).toThrow(/not valid JSON/);
    const bad = { ...FAKE, colors: { ...FAKE.colors, green: { tbspPerBatch: 0 } } };
    expect(() => parseRecipe(JSON.stringify(bad))).toThrow(/colors\.green/);
  });
});

import { describe, it, expect } from "vitest";
import { bulkLotCode, packLotCode, allocate, AllocationError, type Balance } from "./lots";

describe("lot codes", () => {
  it("matches the tracker's format", () => {
    expect(bulkLotCode("2026-10-30", "yellow", 42)).toBe("261030-YL-42");
    expect(bulkLotCode("2026-08-14", "green", 1)).toBe("260814-GR-01");
    expect(packLotCode("2026-08-20", 1)).toBe("MP-260820-01");
  });

  it("rejects a non-ISO date", () => {
    expect(() => bulkLotCode("10/30/2026", "red", 1)).toThrow();
  });
});

const lots: Balance[] = [
  { id: 1, color: "red", madeOn: "2026-10-01", remaining: 3 },
  { id: 2, color: "red", madeOn: "2026-11-01", remaining: 20 },
  { id: 3, color: "yellow", madeOn: "2026-11-01", remaining: 20 },
  { id: 4, color: "green", madeOn: "2026-11-01", remaining: 20 },
  { id: 5, color: "blue", madeOn: "2026-11-01", remaining: 20 },
];

describe("allocate", () => {
  it("draws the oldest lot first and spills into the next", () => {
    const [a] = allocate(lots, { "multi-20": 5 });
    expect(a.components).toEqual(
      expect.arrayContaining([
        { bulkLotId: 1, pouches: 3 },
        { bulkLotId: 2, pouches: 2 },
        { bulkLotId: 3, pouches: 5 },
      ])
    );
  });

  it("carries depletion across variants in one run", () => {
    const out = allocate(lots, { "multi-20": 3, "red-20": 1 });
    const red = out.find((a) => a.variantId === "red-20")!;
    expect(red.components).toEqual([{ bulkLotId: 2, pouches: 4 }]);
  });

  it("refuses to over-draw a color", () => {
    expect(() => allocate(lots, { "red-80": 2 })).toThrow(AllocationError);
  });

  it("refuses an empty plan", () => {
    expect(() => allocate(lots, {})).toThrow(/no kits/);
  });

  it("does not mutate the balances it was given", () => {
    allocate(lots, { "multi-20": 5 });
    expect(lots[0].remaining).toBe(3);
  });
});

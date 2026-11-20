import { describe, it, expect } from "vitest";
import { bulkLotCode, packLotCode, packKits, AllocationError, type Balance } from "./lots";

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

const lot = (id: number, color: Balance["color"], run: number, remaining: number): Balance => ({
  id,
  color,
  lotCode: bulkLotCode(`2026-11-${String(run).padStart(2, "0")}`, color, run),
  madeOn: `2026-11-${String(run).padStart(2, "0")}`,
  remaining,
});

describe("packKits", () => {
  it("labels a single-color kit from one lot with that lot's code", () => {
    const g = packKits([lot(1, "red", 1, 20)], { "red-40": 2 });
    expect(g).toEqual([
      expect.objectContaining({ variantId: "red-40", kits: 2, bulkCode: "261101-RD-01" }),
    ]);
  });

  it("keeps kits whole from one lot and leaves odd pouches on hand", () => {
    // 10 RD-41 + 16 RD-42, three Red 40s: one from 41, two from 42, 2 left in 41.
    const g = packKits([lot(1, "red", 1, 10), lot(2, "red", 2, 16)], { "red-40": 3 });
    expect(g.map((x) => [x.bulkCode, x.kits])).toEqual([
      ["261101-RD-01", 1],
      ["261102-RD-02", 2],
    ]);
  });

  it("mixes lots only when no single lot can fill the kit, and asks for an MP", () => {
    const g = packKits([lot(1, "red", 1, 5), lot(2, "red", 2, 3)], { "red-40": 1 });
    expect(g).toHaveLength(1);
    expect(g[0].bulkCode).toBeNull();
    expect(g[0].perKit).toEqual([
      expect.objectContaining({ bulkLotId: 1, pouches: 5 }),
      expect.objectContaining({ bulkLotId: 2, pouches: 3 }),
    ]);
  });

  it("always asks for an MP on multis, one group per exact set of lots", () => {
    const batch = [lot(1, "red", 1, 9), lot(2, "yellow", 1, 9), lot(3, "green", 1, 9), lot(4, "blue", 1, 9)];
    const older = lot(5, "yellow", 0, 1); // one stray yellow from an earlier run
    older.madeOn = "2026-10-01";
    const g = packKits([...batch, older], { "multi-20": 3 });
    expect(g.every((x) => x.bulkCode === null)).toBe(true);
    expect(g.map((x) => x.kits)).toEqual([1, 2]);
    expect(g[0].perKit.find((p) => p.color === "yellow")!.bulkLotId).toBe(5);
  });

  it("packs big single-color kits before multis so lots stay whole", () => {
    const g = packKits(
      [lot(1, "red", 1, 16), lot(2, "yellow", 1, 1), lot(3, "green", 1, 1), lot(4, "blue", 1, 1), lot(5, "red", 2, 1)],
      { "multi-20": 1, "red-80": 1 }
    );
    expect(g.find((x) => x.variantId === "red-80")!.bulkCode).toBe("261101-RD-01");
  });

  it("refuses to over-draw a color", () => {
    expect(() => packKits([lot(1, "red", 1, 10)], { "red-80": 1 })).toThrow(AllocationError);
  });

  it("refuses an empty plan", () => {
    expect(() => packKits([lot(1, "red", 1, 10)], {})).toThrow(/no kits/);
  });

  it("does not mutate the balances it was given", () => {
    const b = [lot(1, "red", 1, 10)];
    packKits(b, { "red-20": 1 });
    expect(b[0].remaining).toBe(10);
  });
});

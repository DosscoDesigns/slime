/**
 * Lot codes and pouch allocation. Pure — no database.
 *
 *   Bulk lot  YYMMDD-CC-RUN   one color from one mixing run   261030-YL-42
 *   Pack lot  MP-YYMMDD-RUN   one packing run (all FNSKUs)    MP-261120-43
 *
 * The lot follows the material: a kit records the bulk lots its pouches came
 * from, even when leftover bulk is packed in a later run.
 */
import type { SlimeColor } from "@/lib/products";
import { PACK_COLORS, PACK_VARIANTS, usage, type Plan } from "@/lib/packaging";

export const COLOR_CODE: Record<SlimeColor, string> = {
  red: "RD",
  yellow: "YL",
  green: "GR",
  blue: "BL",
};

/** YYMMDD from an ISO date (YYYY-MM-DD). Calendar date, no timezone math. */
export function yymmdd(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`not an ISO date: ${isoDate}`);
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

const run = (n: number) => String(n).padStart(2, "0");

export function bulkLotCode(isoDate: string, color: SlimeColor, runNo: number): string {
  return `${yymmdd(isoDate)}-${COLOR_CODE[color]}-${run(runNo)}`;
}

export function packLotCode(isoDate: string, runNo: number): string {
  return `MP-${yymmdd(isoDate)}-${run(runNo)}`;
}

export interface Balance {
  id: number;
  color: SlimeColor;
  madeOn: string;
  remaining: number;
}

export interface Allocation {
  variantId: string;
  kits: number;
  components: { bulkLotId: number; pouches: number }[];
}

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

/**
 * Assign pouches to each FNSKU in the plan, oldest bulk lot first per color.
 * Throws rather than over-drawing: a short color means the plan is wrong or
 * a batch was never logged, and either way the labels must not print.
 */
export function allocate(balances: Balance[], plan: Plan): Allocation[] {
  const pools = new Map<SlimeColor, Balance[]>();
  for (const c of PACK_COLORS) {
    pools.set(
      c,
      balances
        .filter((b) => b.color === c && b.remaining > 0)
        .sort((a, b) => a.madeOn.localeCompare(b.madeOn) || a.id - b.id)
        .map((b) => ({ ...b }))
    );
  }

  const out: Allocation[] = [];
  for (const v of PACK_VARIANTS) {
    const kits = plan[v.id] ?? 0;
    if (kits <= 0) continue;
    const per = usage(v);
    const used = new Map<number, number>();
    for (const c of PACK_COLORS) {
      let need = per[c] * kits;
      for (const lot of pools.get(c)!) {
        if (need === 0) break;
        const take = Math.min(need, lot.remaining);
        if (take === 0) continue;
        lot.remaining -= take;
        need -= take;
        used.set(lot.id, (used.get(lot.id) ?? 0) + take);
      }
      if (need > 0) {
        throw new AllocationError(`Not enough ${c} pouches logged for ${v.name} (short ${need}).`);
      }
    }
    out.push({
      variantId: v.id,
      kits,
      components: [...used].map(([bulkLotId, pouches]) => ({ bulkLotId, pouches })),
    });
  }
  if (out.length === 0) throw new AllocationError("The plan has no kits in it.");
  return out;
}

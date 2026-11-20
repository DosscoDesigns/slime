/**
 * Lot codes and pouch allocation. Pure — no database.
 *
 *   Bulk lot  YYMMDD-CC-RUN   one color from one mixing run   261030-YL-42
 *   Mixed     MP-YYMMDD-NN    a kit whose pouches span lots   MP-261120-03
 *
 * A single-color kit filled from one bulk lot is labelled with that lot's
 * code. A multi-color kit, or a single-color kit drawn from two lots, gets an
 * MP code, and the database records exactly which lots it holds. One MP code
 * always means one exact set of lots.
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
  lotCode: string;
  color: SlimeColor;
  madeOn: string;
  remaining: number;
}

/**
 * Kits of one FNSKU that hold exactly the same bulk lots. Each group gets one
 * label code: the bulk lot itself when a single-color kit comes from one
 * lot, otherwise an MP code (assigned when the packing is recorded).
 */
export interface KitGroup {
  variantId: string;
  kits: number;
  /** Pouches per kit from each bulk lot. */
  perKit: { bulkLotId: number; lotCode: string; color: SlimeColor; pouches: number }[];
  /** The bulk lot code to print, or null when this group needs an MP code. */
  bulkCode: string | null;
}

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

const oldestFirst = (a: Balance, b: Balance) => a.madeOn.localeCompare(b.madeOn) || a.id - b.id;

/**
 * Assign pouches kit by kit. For each color a kit needs, take them all from
 * the oldest lot that can cover it, so a kit stays single-batch whenever it
 * can; only when no one lot is big enough does the kit mix lots (oldest
 * first). Odd pouches that don't fill a kit are left on hand.
 *
 * Kits needing the most pouches of one color go first, so a small multi
 * doesn't break up a lot an 80-gal single needed whole.
 *
 * Throws rather than over-drawing: the labels must not print for pouches
 * that were never logged.
 */
export function packKits(balances: Balance[], plan: Plan): KitGroup[] {
  const pools = new Map<SlimeColor, Balance[]>();
  for (const c of PACK_COLORS) {
    pools.set(
      c,
      balances
        .filter((b) => b.color === c && b.remaining > 0)
        .sort(oldestFirst)
        .map((b) => ({ ...b }))
    );
  }

  const order = PACK_VARIANTS.filter((v) => (plan[v.id] ?? 0) > 0).sort(
    (a, b) => Math.max(...PACK_COLORS.map((c) => usage(b)[c])) - Math.max(...PACK_COLORS.map((c) => usage(a)[c]))
  );
  if (order.length === 0) throw new AllocationError("The plan has no kits in it.");

  const groups = new Map<string, KitGroup>();
  for (const v of order) {
    const per = usage(v);
    for (let k = 0; k < plan[v.id]; k++) {
      const kit: KitGroup["perKit"] = [];
      for (const c of PACK_COLORS) {
        const need = per[c];
        if (!need) continue;
        const pool = pools.get(c)!;
        const whole = pool.find((l) => l.remaining >= need);
        if (whole) {
          whole.remaining -= need;
          kit.push({ bulkLotId: whole.id, lotCode: whole.lotCode, color: c, pouches: need });
          continue;
        }
        let left = need;
        for (const l of pool) {
          if (!left) break;
          const take = Math.min(left, l.remaining);
          if (!take) continue;
          l.remaining -= take;
          left -= take;
          kit.push({ bulkLotId: l.id, lotCode: l.lotCode, color: c, pouches: take });
        }
        if (left > 0) {
          throw new AllocationError(
            `Not enough ${c} pouches in the batches picked: ran out partway through ${v.name}.`
          );
        }
      }
      const key = `${v.id}|${kit.map((p) => `${p.bulkLotId}:${p.pouches}`).join(",")}`;
      const g = groups.get(key);
      if (g) g.kits++;
      else
        groups.set(key, {
          variantId: v.id,
          kits: 1,
          perKit: kit,
          bulkCode: v.color && kit.length === 1 ? kit[0].lotCode : null,
        });
    }
  }
  const idx = (id: string) => PACK_VARIANTS.findIndex((v) => v.id === id);
  return [...groups.values()].sort((a, b) => idx(a.variantId) - idx(b.variantId));
}

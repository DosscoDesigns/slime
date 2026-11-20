/**
 * What can be packed from the pouches on hand.
 *
 * One pouch makes ~5 gallons, so a kit's gallons ÷ 5 is its pouch count. A
 * multi-color kit splits that evenly across the four colors; a single-color
 * kit is all one color. Pure — no Amazon or database calls.
 */
import type { SlimeColor } from "@/lib/products";

export const PACK_COLORS: SlimeColor[] = ["red", "yellow", "green", "blue"];

export type Counts = Record<SlimeColor, number>;

export interface PackVariant {
  id: string;
  name: string;
  gallons: 20 | 40 | 80;
  /** null = multi-color (RYGB). */
  color: SlimeColor | null;
  /**
   * Amazon FNSKU for the FBA label, as of 2026-11-20 from the SP-API FBA
   * inventory endpoint. null = no FNSKU yet (listing not set to FBA).
   */
  fnsku: string | null;
}

const GALLONS = [20, 40, 80] as const;
const COLOR_NAME: Record<SlimeColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

// Where Amazon has more than one SKU for a listing, the one carrying inventory
// is used. Multi 40G also has X005F46NAD/X005F46GDR and Red 80G X005F474CT.
const FNSKU: Record<string, string> = {
  "multi-20": "X0055YOG1L",
  "multi-40": "X0055YTXTB",
  "multi-80": "X0058YM7F5",
  "red-20": "X005AN7BIR",
  "red-40": "X0059BD4LD",
  "red-80": "X005AMX96B",
  "yellow-40": "X005AMY1WR",
  "green-20": "X0059BBFOL",
  "green-40": "X005994761",
  "green-80": "X005993UG9",
};

export const PACK_VARIANTS: PackVariant[] = [null, ...PACK_COLORS].flatMap((color) =>
  GALLONS.map((gallons): PackVariant => {
    const id = `${color ?? "multi"}-${gallons}`;
    return {
      id,
      name: `${color ? COLOR_NAME[color] : "RYGB Multi"} · ${gallons} gal`,
      gallons,
      color,
      fnsku: FNSKU[id] ?? null,
    };
  })
);

export function pouchesPerKit(v: PackVariant): number {
  return v.gallons / 5;
}

/** Pouches of each color one kit of this variant uses. */
export function usage(v: PackVariant): Counts {
  const n = pouchesPerKit(v);
  if (v.color === null) {
    const each = n / PACK_COLORS.length;
    return { red: each, yellow: each, green: each, blue: each };
  }
  return { red: 0, yellow: 0, green: 0, blue: 0, [v.color]: n };
}

export type Plan = Record<string, number>;

export function remaining(onHand: Counts, plan: Plan): Counts {
  const left = { ...onHand };
  for (const v of PACK_VARIANTS) {
    const qty = plan[v.id] ?? 0;
    if (!qty) continue;
    const u = usage(v);
    for (const c of PACK_COLORS) left[c] -= u[c] * qty;
  }
  return left;
}

export function feasible(onHand: Counts, plan: Plan): boolean {
  const left = remaining(onHand, plan);
  return PACK_COLORS.every((c) => left[c] >= 0);
}

/** Leftovers of each color packed into single-color kits, largest size first. */
function packSingles(left: Counts, plan: Plan, sizes: readonly (20 | 40 | 80)[]): void {
  for (const c of PACK_COLORS) {
    for (const g of sizes) {
      const v = PACK_VARIANTS.find((x) => x.color === c && x.gallons === g)!;
      const n = pouchesPerKit(v);
      const qty = Math.floor(left[c] / n);
      if (qty > 0) {
        plan[v.id] = (plan[v.id] ?? 0) + qty;
        left[c] -= qty * n;
      }
    }
  }
}

export interface PlanOption {
  label: string;
  plan: Plan;
  leftover: Counts;
}

/**
 * Starting points, not answers: each fills multi-color kits first (one size),
 * then packs what's left of each color into single-color kits.
 */
export function suggestPlans(onHand: Counts): PlanOption[] {
  const options: PlanOption[] = [];
  for (const g of GALLONS) {
    const multi = PACK_VARIANTS.find((v) => v.color === null && v.gallons === g)!;
    const each = pouchesPerKit(multi) / PACK_COLORS.length;
    const qty = Math.floor(Math.min(...PACK_COLORS.map((c) => onHand[c])) / each);
    const plan: Plan = qty > 0 ? { [multi.id]: qty } : {};
    const left = remaining(onHand, plan);
    packSingles(left, plan, [20]);
    options.push({ label: `Max ${g} gal multi, rest as 20 gal singles`, plan, leftover: left });
  }
  const singles: Plan = {};
  const left = { ...onHand };
  packSingles(left, singles, [80, 40, 20]);
  options.push({ label: "Single-color only, largest first", plan: singles, leftover: left });
  return options;
}

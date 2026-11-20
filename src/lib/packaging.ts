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
  /** Product title printed on the FBA label, matching the Amazon listing. */
  title: string;
}

const GALLONS = [20, 40, 80] as const;
const COLOR_NAME: Record<SlimeColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

/**
 * Amazon listings per variant, from the SP-API FBA inventory endpoint
 * (2026-11-20). The first entry is the one we label with; extras are
 * duplicate SKUs Amazon holds for the same listing and are shown for their
 * stock only. A variant with no entry has no FBA listing yet.
 */
export const AMAZON_LISTINGS: Record<string, { sellerSku: string; fnsku: string }[]> = {
  "multi-20": [{ sellerSku: "WG-WSYO-O5LJ", fnsku: "X0055YOG1L" }],
  "multi-40": [
    { sellerSku: "YX-O588-0X40", fnsku: "X0055YTXTB" },
    { sellerSku: "1R-9836-2X2X", fnsku: "X005F46NAD" },
    { sellerSku: "ER-NQBJ-UXQ7", fnsku: "X005F46GDR" },
  ],
  "multi-80": [{ sellerSku: "FW-5MV4-7L0Y", fnsku: "X0058YM7F5" }],
  "red-20": [{ sellerSku: "HP-IQWX-RCGQ", fnsku: "X005AN7BIR" }],
  "red-40": [{ sellerSku: "87-H8Z9-PKIP", fnsku: "X0059BD4LD" }],
  "red-80": [
    { sellerSku: "8B-VVYL-Y68P", fnsku: "X005AMX96B" },
    { sellerSku: "B5-BIQT-3N9I", fnsku: "X005F474CT" },
  ],
  "yellow-40": [{ sellerSku: "84-QJ9K-9V9Q", fnsku: "X005AMY1WR" }],
  "blue-20": [{ sellerSku: "PA-K6OW-HKFY", fnsku: "X005FGMKGR" }],
  "blue-80": [{ sellerSku: "YN-7IO8-4BFC", fnsku: "X005FH1Q0R" }],
  "yellow-20": [{ sellerSku: "6T-46XP-4240", fnsku: "X005FGQ3B5" }],
  // Set to FBA 2026-11-20 but no FNSKU from Amazon yet:
  //   blue-40 9L-S3O4-0ETA, yellow-80 AI-W7N6-9ZSD
  "green-20": [{ sellerSku: "UR-GUFX-I8M3", fnsku: "X0059BBFOL" }],
  "green-40": [{ sellerSku: "E6-64N7-9SR8", fnsku: "X005994761" }],
  "green-80": [{ sellerSku: "GE-NIB9-EFDH", fnsku: "X005993UG9" }],
};

export const PACK_VARIANTS: PackVariant[] = [null, ...PACK_COLORS].flatMap((color) =>
  GALLONS.map((gallons): PackVariant => {
    const id = `${color ?? "multi"}-${gallons}`;
    return {
      id,
      name: `${color ? COLOR_NAME[color] : "RYGB Multi"} · ${gallons} gal`,
      gallons,
      color,
      fnsku: AMAZON_LISTINGS[id]?.[0].fnsku ?? null,
      title: `The Slime Co Instant Slime Powder (${color ? COLOR_NAME[color] : "RYGB Multi"}, ${gallons} Gallons)`,
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
      if (!v.fnsku) continue; // can't be labelled, so don't suggest it
      const n = pouchesPerKit(v);
      const qty = Math.floor(left[c] / n);
      if (qty > 0) {
        plan[v.id] = (plan[v.id] ?? 0) + qty;
        left[c] -= qty * n;
      }
    }
  }
}

/**
 * Add kits one at a time to whichever variant has the fewest units (FBA stock
 * plus what's already planned), until nothing else fits. `cap` limits the
 * pouches of each color this pass may use.
 */
function levelUp(
  left: Counts,
  plan: Plan,
  variants: PackVariant[],
  have: Record<string, number>,
  cap: Counts = left
): void {
  const budget = { ...cap };
  for (;;) {
    // A kit fits if the pouches exist and taking it lands nearer the cap than
    // stopping short would (kits come in 8-pouch steps, so "≤ cap" undershoots).
    const fits = variants.filter((v) =>
      PACK_COLORS.every((c) => {
        const u = usage(v)[c];
        return u === 0 || (u <= left[c] && budget[c] * 2 >= u);
      })
    );
    if (fits.length === 0) return;
    const units = (v: PackVariant) => (have[v.id] ?? 0) + (plan[v.id] ?? 0);
    const v = fits.reduce((best, x) => (units(x) < units(best) ? x : best));
    plan[v.id] = (plan[v.id] ?? 0) + 1;
    for (const c of PACK_COLORS) {
      left[c] -= usage(v)[c];
      budget[c] -= usage(v)[c];
    }
  }
}

export interface PlanOption {
  label: string;
  plan: Plan;
  leftover: Counts;
}

const labelled = (g: number) => PACK_VARIANTS.filter((v) => v.gallons === g && v.fnsku);

/**
 * Starting points, not answers. No 80-gal kits: they're packed on purpose,
 * not suggested. `have` is FBA units per variant (stock + inbound), used to
 * level up the thinnest listings first; without it every listing counts as 0.
 */
export function suggestPlans(onHand: Counts, have: Record<string, number> = {}): PlanOption[] {
  const options: PlanOption[] = [];

  {
    const plan: Plan = {};
    const left = { ...onHand };
    levelUp(left, plan, [...labelled(20), ...labelled(40)], have);
    options.push({ label: "Even out stock (20 & 40 gal)", plan, leftover: left });
  }
  {
    const plan: Plan = {};
    const left = { ...onHand };
    const cap = Object.fromEntries(PACK_COLORS.map((c) => [c, Math.floor(onHand[c] * 0.8)])) as Counts;
    levelUp(left, plan, labelled(40), have, cap);
    levelUp(left, plan, labelled(20), have);
    levelUp(left, plan, labelled(40), have); // a color with no 20 listing (yellow) still gets packed
    options.push({ label: "~80% 40 gal, rest 20 gal", plan, leftover: left });
  }
  for (const g of [20, 40] as const) {
    const multi = PACK_VARIANTS.find((v) => v.color === null && v.gallons === g)!;
    const each = pouchesPerKit(multi) / PACK_COLORS.length;
    const qty = Math.floor(Math.min(...PACK_COLORS.map((c) => onHand[c])) / each);
    const plan: Plan = qty > 0 ? { [multi.id]: qty } : {};
    const left = remaining(onHand, plan);
    packSingles(left, plan, [20, 40]); // 40 only where a color has no 20 listing
    options.push({ label: `Max ${g} gal multi, rest as singles`, plan, leftover: left });
  }
  return options;
}

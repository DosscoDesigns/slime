/**
 * Batch math for the manufacturing screen.
 *
 * Pure and recipe-agnostic: every function takes the recipe as an argument.
 * The real recipe is a trade secret and never appears in this repo — it is
 * loaded at request time by src/lib/recipe.ts from a server-only env var.
 * Tests use an obviously fake recipe.
 */
import type { SlimeColor } from "@/lib/products";

export const GRAMS_PER_LB = 453.59237;
export const TSP_PER_TBSP = 3;

export const COLOR_ORDER: SlimeColor[] = ["red", "yellow", "green", "blue"];

export interface ColorantSpec {
  /**
   * Colorant for ONE single-color batch of the base. Deliberately different
   * per color (yellow needs more to read as deep) — it does not change yield.
   */
  tbspPerBatch: number;
}

export interface Recipe {
  /** Base for ONE single-color batch. Poly:malto is the same for every color. */
  polyGrams: number;
  maltoGrams: number;
  /** Pouches one batch fills. The same for every color. */
  pouchesPerBatch: number;
  colors: Record<SlimeColor, ColorantSpec>;
}

export type BaseIngredient = "poly" | "malto";

export interface BatchInput {
  /** Pounds of the base ingredient on hand. */
  amountLb: number;
  base: BaseIngredient;
  /** The amount is split evenly across these colors. */
  colors: SlimeColor[];
}

export interface ColorPlan {
  color: SlimeColor;
  polyGrams: number;
  maltoGrams: number;
  totalGrams: number;
  /** Batches of this color the amount works out to (1 = one recipe batch). */
  batchFactor: number;
  colorantTsp: number;
  /** Whole pouches this much base fills. */
  pouches: number;
  /** Colorant per pouch, for topping up a short fill. */
  colorantTspPerPouch: number;
}

export interface BatchPlan {
  perColor: ColorPlan[];
  totals: { polyGrams: number; maltoGrams: number; totalGrams: number; pouches: number };
}

export class BatchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchInputError";
  }
}

export function planBatch(recipe: Recipe, input: BatchInput): BatchPlan {
  if (!(input.amountLb > 0)) throw new BatchInputError("Enter how many pounds you have.");
  if (input.colors.length === 0) throw new BatchInputError("Pick at least one color.");

  const baseGramsPerBatch = input.base === "poly" ? recipe.polyGrams : recipe.maltoGrams;
  const gramsPerColor = (input.amountLb * GRAMS_PER_LB) / input.colors.length;
  const factor = gramsPerColor / baseGramsPerBatch;

  const ordered = COLOR_ORDER.filter((c) => input.colors.includes(c));
  const perColor = ordered.map((color): ColorPlan => {
    const spec = recipe.colors[color];
    const polyGrams = recipe.polyGrams * factor;
    const maltoGrams = recipe.maltoGrams * factor;
    const colorantTsp = spec.tbspPerBatch * TSP_PER_TBSP * factor;
    return {
      color,
      polyGrams,
      maltoGrams,
      totalGrams: polyGrams + maltoGrams,
      batchFactor: factor,
      colorantTsp,
      pouches: Math.floor(factor * recipe.pouchesPerBatch + 1e-9),
      colorantTspPerPouch: (spec.tbspPerBatch * TSP_PER_TBSP) / recipe.pouchesPerBatch,
    };
  });

  const sum = (f: (p: ColorPlan) => number) => perColor.reduce((s, p) => s + f(p), 0);
  return {
    perColor,
    totals: {
      polyGrams: sum((p) => p.polyGrams),
      maltoGrams: sum((p) => p.maltoGrams),
      totalGrams: sum((p) => p.totalGrams),
      pouches: sum((p) => p.pouches),
    },
  };
}

const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];

/** "2 T + 1¼ tsp", rounded to the nearest ⅛ tsp — the smallest spoon we measure with. */
export function formatSpoons(tsp: number): string {
  const totalEighths = Math.round(tsp * 8);
  if (totalEighths <= 0) return "0 tsp";
  const tbsp = Math.floor(totalEighths / (TSP_PER_TBSP * 8));
  const restEighths = totalEighths - tbsp * TSP_PER_TBSP * 8;
  const whole = Math.floor(restEighths / 8);
  const frac = EIGHTHS[restEighths % 8];
  const tspPart = restEighths > 0 ? `${whole > 0 ? whole : ""}${frac} tsp` : "";
  if (tbsp > 0 && tspPart) return `${tbsp} T + ${tspPart}`;
  if (tbsp > 0) return `${tbsp} T`;
  return tspPart;
}

export function formatGrams(g: number): string {
  return `${Math.round(g).toLocaleString("en-US")} g`;
}

export function formatPounds(g: number): string {
  return `${(g / GRAMS_PER_LB).toFixed(2)} lb`;
}

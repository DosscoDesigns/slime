/**
 * Loads the production recipe. SERVER-ONLY.
 *
 * The recipe is a trade secret (see CLAUDE.md), so it is never committed. It
 * lives in 1Password (op://DEV/slime.recipe) and reaches the app as the
 * SLIME_RECIPE env var — no NEXT_PUBLIC_ prefix, so it is never bundled for
 * the browser. Only the admin manufacturing screen reads it, after
 * requireAdmin(), and only computed amounts are rendered.
 */
import type { Recipe, ColorantSpec } from "@/lib/manufacturing";
import { COLOR_ORDER } from "@/lib/manufacturing";

export class RecipeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeConfigError";
  }
}

const positive = (v: unknown): v is number => typeof v === "number" && v > 0;

/** Parse and validate. Error messages name fields, never values. */
export function parseRecipe(raw: string | undefined): Recipe {
  if (typeof window !== "undefined") {
    throw new RecipeConfigError("recipe.ts was imported into browser code");
  }
  if (!raw) throw new RecipeConfigError("SLIME_RECIPE is not set");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new RecipeConfigError("SLIME_RECIPE is not valid JSON");
  }
  const r = data as Partial<Recipe>;
  if (!positive(r.polyGrams) || !positive(r.maltoGrams)) {
    throw new RecipeConfigError("SLIME_RECIPE needs positive polyGrams and maltoGrams");
  }
  const colors = {} as Recipe["colors"];
  for (const c of COLOR_ORDER) {
    const spec = r.colors?.[c] as Partial<ColorantSpec> | undefined;
    if (!positive(spec?.tbspPerBatch) || !positive(spec?.tspPerPouch)) {
      throw new RecipeConfigError(
        `SLIME_RECIPE colors.${c} needs positive tbspPerBatch and tspPerPouch`
      );
    }
    colors[c] = { tbspPerBatch: spec.tbspPerBatch, tspPerPouch: spec.tspPerPouch };
  }
  return { polyGrams: r.polyGrams, maltoGrams: r.maltoGrams, colors };
}

export function loadRecipe(): Recipe {
  return parseRecipe(process.env.SLIME_RECIPE);
}

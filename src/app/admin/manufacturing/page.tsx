import { requireAdmin } from "@/lib/admin-session";
import { loadRecipe, RecipeConfigError } from "@/lib/recipe";
import {
  planBatch,
  formatSpoons,
  formatGrams,
  formatPounds,
  COLOR_ORDER,
  BatchInputError,
  type BaseIngredient,
  type BatchPlan,
} from "@/lib/manufacturing";
import type { SlimeColor } from "@/lib/products";
import { traceabilityConfigured, nextBulkRunNo } from "@/lib/traceability";
import { GRAMS_PER_LB } from "@/lib/manufacturing";
import LogBatch from "./log-batch";

export const dynamic = "force-dynamic";

const COLOR_LABEL: Record<SlimeColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

const COLOR_DOT: Record<SlimeColor, string> = {
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-lime-500",
  blue: "bg-sky-500",
};

type Params = { lb?: string; base?: string; c?: string | string[] };

export default async function Manufacturing({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  // Auth first: the recipe is not read until the session is proven.
  await requireAdmin();
  const params = await searchParams;

  const base: BaseIngredient = params.base === "malto" ? "malto" : "poly";
  const picked = ([] as string[]).concat(params.c ?? []);
  const submitted = params.lb !== undefined;
  const colors = submitted
    ? COLOR_ORDER.filter((c) => picked.includes(c))
    : [...COLOR_ORDER];
  const amountLb = Number(params.lb ?? "");

  let plan: BatchPlan | null = null;
  let error: string | null = null;
  try {
    const recipe = loadRecipe();
    if (submitted) plan = planBatch(recipe, { amountLb, base, colors });
  } catch (e) {
    if (e instanceof RecipeConfigError) {
      error = `Recipe not configured: ${e.message}. Set SLIME_RECIPE from 1Password (op://DEV/slime.recipe).`;
    } else if (e instanceof BatchInputError) {
      error = e.message;
    } else {
      throw e;
    }
  }

  const other = base === "poly" ? "Malto" : "Poly";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Mix</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the base you have on hand. It is split evenly across the colors you
          pick, and {other.toLowerCase()} and colorant are scaled to match.
        </p>
      </header>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Pounds on hand</span>
          <input
            name="lb"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={params.lb ?? ""}
            className="w-28 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Of</span>
          <select
            name="base"
            defaultValue={base}
            className="rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
          >
            <option value="poly">Poly</option>
            <option value="malto">Malto</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 text-zinc-400">Colors</legend>
          <div className="flex gap-3">
            {COLOR_ORDER.map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" name="c" value={c} defaultChecked={colors.includes(c)} />
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[c]}`} />
                {COLOR_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className="rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300"
        >
          Calculate
        </button>
      </form>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {plan ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-left text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Color</th>
                <th className="px-4 py-2 font-medium">Poly</th>
                <th className="px-4 py-2 font-medium">Malto</th>
                <th className="px-4 py-2 font-medium">Total (poly + malto)</th>
                <th className="px-4 py-2 font-medium">Colorant</th>
                <th className="px-4 py-2 text-right font-medium">≈ Pouches</th>
              </tr>
            </thead>
            <tbody>
              {plan.perColor.map((p) => (
                <tr key={p.color} className="border-t border-zinc-800">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[p.color]}`} />
                      {COLOR_LABEL[p.color]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatGrams(p.polyGrams)}
                    <span className="block text-xs text-zinc-500">{formatPounds(p.polyGrams)}</span>
                  </td>
                  <td className="px-4 py-2">
                    {formatGrams(p.maltoGrams)}
                    <span className="block text-xs text-zinc-500">{formatPounds(p.maltoGrams)}</span>
                  </td>
                  <td className="px-4 py-2">{formatGrams(p.totalGrams)}</td>
                  <td className="px-4 py-2">
                    <span className="font-semibold text-lime-400">{formatSpoons(p.colorantTsp)}</span>
                    <span className="block text-xs text-zinc-500">
                      {formatSpoons(p.colorantTspPerPouch)} / pouch
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{p.pouches}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-700 bg-zinc-950 font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2">{formatGrams(plan.totals.polyGrams)}</td>
                <td className="px-4 py-2">{formatGrams(plan.totals.maltoGrams)}</td>
                <td className="px-4 py-2">{formatGrams(plan.totals.totalGrams)}</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right">{plan.totals.pouches}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {plan && traceabilityConfigured() ? (
        <LogBatch
          colors={plan.perColor.map((p) => ({ color: p.color, estimate: p.pouches }))}
          base={base}
          baseLbPerColor={
            (base === "poly" ? plan.perColor[0].polyGrams : plan.perColor[0].maltoGrams) / GRAMS_PER_LB
          }
          nextRunNo={await nextBulkRunNo()}
          today={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
        />
      ) : plan ? (
        <p className="mt-6 text-sm text-zinc-500">
          Batch logging needs the traceability database (SLIME_DATABASE_URL), which isn&apos;t
          connected here yet.
        </p>
      ) : null}

      <p className="mt-4 text-xs text-zinc-600">
        Colorant is rounded to the nearest ⅛ tsp. Pouch counts are what a full batch
        fills; record the actual count when you log the batch.
      </p>
    </main>
  );
}

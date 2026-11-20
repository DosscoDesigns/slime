"use client";

import { useActionState, useState } from "react";
import {
  AMAZON_LISTINGS,
  PACK_COLORS,
  PACK_VARIANTS,
  pouchesPerKit,
  remaining,
  suggestPlans,
  type Counts,
  type Plan,
} from "@/lib/packaging";
import type { FbaStock } from "@/lib/amazon-inventory";
import type { SlimeColor } from "@/lib/products";
import { packKits, AllocationError, type Balance, type KitGroup } from "@/lib/lots";
import { recordPackRun, type ActionState } from "../lots-actions";

export interface PlannerBatch {
  key: string;
  madeOn: string;
  remaining: Counts;
  lots: Balance[];
}

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
const ZERO: Counts = { red: 0, yellow: 0, green: 0, blue: 0 };
const VARIANT_NAME = Object.fromEntries(PACK_VARIANTS.map((v) => [v.id, v.name]));

const toInt = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

function StockCells({ variantId, stock }: { variantId: string; stock: Record<string, FbaStock> | null }) {
  const listings = AMAZON_LISTINGS[variantId] ?? [];
  if (!stock || listings.length === 0) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <td key={i} className="px-3 py-2 text-right text-zinc-600">
            —
          </td>
        ))}
      </>
    );
  }
  const main = stock[listings[0].fnsku];
  const extras = listings.slice(1).map((l) => stock[l.fnsku]).filter((s) => s && s.total > 0);
  const cell = (n: number | undefined, strong = false) => (
    <td className={`px-3 py-2 text-right ${strong && n ? "font-semibold text-zinc-100" : "text-zinc-400"}`}>
      {n ?? 0}
    </td>
  );
  return (
    <>
      {cell(main?.available, true)}
      {cell(main?.inbound)}
      {cell(main?.reserved)}
      <td className="px-3 py-2 text-right text-zinc-400">
        {main?.total ?? 0}
        {extras.length > 0 ? (
          <span className="block text-[11px] text-amber-300">
            +{extras.reduce((s, x) => s + x.total, 0)} on duplicate SKU
          </span>
        ) : null}
      </td>
    </>
  );
}

export default function Planner({
  batches,
  initialBatch,
  stock,
  stockConfigured,
  today,
}: {
  batches: PlannerBatch[];
  initialBatch: string | null;
  stock: Record<string, FbaStock> | null;
  stockConfigured: boolean;
  today: string;
}) {
  const [picked, setPicked] = useState<string[]>(initialBatch ? [initialBatch] : []);
  const [plan, setPlan] = useState<Plan>({});
  const [state, action, pending] = useActionState<ActionState, FormData>(recordPackRun, {
    error: null,
  });

  const chosen = batches.filter((b) => picked.includes(b.key));
  const lots = chosen.flatMap((b) => b.lots);
  const onHand = chosen.reduce(
    (sum, b) => Object.fromEntries(PACK_COLORS.map((c) => [c, sum[c] + b.remaining[c]])) as Counts,
    ZERO
  );
  const left = remaining(onHand, plan);
  const options = suggestPlans(onHand);
  const over = PACK_COLORS.filter((c) => left[c] < 0);
  const kits = PACK_VARIANTS.reduce((s, v) => s + (plan[v.id] ?? 0), 0);
  const unlabelled = PACK_VARIANTS.filter((v) => (plan[v.id] ?? 0) > 0 && !v.fnsku);
  const hasStock = PACK_COLORS.some((c) => onHand[c] > 0);

  // The same allocation the server runs, so the preview shows the codes that will print.
  let groups: KitGroup[] = [];
  let allocError: string | null = null;
  if (kits > 0 && over.length === 0) {
    try {
      groups = packKits(lots, plan);
    } catch (e) {
      allocError = e instanceof AllocationError ? e.message : String(e);
    }
  }
  const recordBlocked = kits === 0 || over.length > 0 || unlabelled.length > 0 || allocError !== null;
  const toggle = (key: string) =>
    setPicked(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]);

  if (batches.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No pouches on hand. Mix a batch and log its pouches, and it will open here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950">
        <div className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Pack from</h2>
          <div className="space-y-2">
            {batches.map((b) => {
              const on = picked.includes(b.key);
              return (
                <label
                  key={b.key}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded border px-3 py-2 text-sm ${
                    on ? "border-lime-400/50 bg-lime-400/5" : "border-zinc-800"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(b.key)} />
                  <span className="font-mono font-semibold">{b.key}</span>
                  <span className="text-xs text-zinc-500">mixed {b.madeOn}</span>
                  {PACK_COLORS.map((c) => (
                    <span key={c} className="flex items-center gap-1.5 text-zinc-300">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[c]}`} />
                      {b.remaining[c]}
                    </span>
                  ))}
                  {b.key === initialBatch ? (
                    <span className="text-xs text-lime-400">this batch</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
        <div className="border-t border-zinc-800 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-semibold">{kits} kits</span>
            {PACK_COLORS.map((c) => (
              <span key={c} className={left[c] < 0 ? "font-semibold text-red-400" : "text-zinc-400"}>
                {COLOR_LABEL[c]} left: {left[c]}
              </span>
            ))}
            {kits > 0 ? (
              <button
                type="button"
                onClick={() => setPlan({})}
                className="ml-auto text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            ) : null}
          </div>
          {over.length > 0 ? (
            <p className="mt-2 text-red-300">
              Short on {over.map((c) => COLOR_LABEL[c].toLowerCase()).join(", ")}: this plan needs
              more pouches than the batches you picked.
            </p>
          ) : null}
          {unlabelled.length > 0 ? (
            <p className="mt-2 text-amber-200">
              No FNSKU yet for {unlabelled.map((v) => v.name).join(", ")}. Set the listing to FBA
              in Seller Central before packing these for Amazon.
            </p>
          ) : null}
        </div>
      </section>

      {hasStock ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">Starting plans</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const parts = PACK_VARIANTS.filter((v) => o.plan[v.id]).map(
                (v) => `${o.plan[v.id]}× ${v.name}`
              );
              const spare = PACK_COLORS.filter((c) => o.leftover[c] > 0)
                .map((c) => `${o.leftover[c]} ${COLOR_LABEL[c].toLowerCase()}`)
                .join(", ");
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPlan(o.plan)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm hover:border-lime-400/60"
                >
                  <span className="font-semibold text-lime-400">{o.label}</span>
                  <span className="mt-1 block text-zinc-300">{parts.join(" · ") || "Nothing fits"}</span>
                  <span className="mt-1 block text-xs text-zinc-500">Left over: {spare || "none"}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-3 py-2 font-medium">FNSKU</th>
              <th className="px-3 py-2 font-medium">Pouches</th>
              <th className="px-3 py-2 text-right font-medium">Available</th>
              <th className="px-3 py-2 text-right font-medium">Inbound</th>
              <th className="px-3 py-2 text-right font-medium">Reserved</th>
              <th className="px-3 py-2 text-right font-medium">FBA total</th>
              <th className="px-4 py-2 text-right font-medium">Kits to pack</th>
            </tr>
          </thead>
          <tbody>
            {PACK_VARIANTS.map((v) => (
              <tr key={v.id} className="border-t border-zinc-800">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    {v.color ? (
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[v.color]}`} />
                    ) : (
                      <span className="flex gap-0.5">
                        {PACK_COLORS.map((c) => (
                          <span key={c} className={`h-2.5 w-1 rounded-sm ${COLOR_DOT[c]}`} />
                        ))}
                      </span>
                    )}
                    {v.name}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {v.fnsku ?? <span className="text-amber-300">not on FBA yet</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                  {v.color ? pouchesPerKit(v) : `${pouchesPerKit(v) / 4}/ea`}
                </td>
                <StockCells variantId={v.id} stock={stock} />
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-label={`Kits of ${v.name}`}
                    value={plan[v.id] || ""}
                    onChange={(e) => setPlan({ ...plan, [v.id]: toInt(e.target.value) })}
                    className="w-20 rounded border border-zinc-700 bg-black px-2 py-1 text-right text-zinc-100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stock ? (
          <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
            {stockConfigured
              ? "Couldn't reach Amazon for FBA stock just now; reload to retry."
              : "FBA stock needs the Amazon connection, which isn't set up here."}
          </p>
        ) : (
          <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
            FBA stock is live from Amazon (refreshed every 2 minutes). Inbound = working + shipped
            + receiving.
          </p>
        )}
      </section>

      <form action={action} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-300">Record packing &amp; print labels</h2>
        {groups.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {groups.map((g, i) => (
              <li key={i}>
                <span className="font-semibold">{g.kits}×</span> {VARIANT_NAME[g.variantId]} →{" "}
                {g.bulkCode ? (
                  <span className="font-mono text-lime-400">{g.bulkCode}</span>
                ) : (
                  <>
                    <span className="font-mono text-lime-400">MP code</span>
                    <span className="text-xs text-zinc-500">
                      {" "}
                      ({g.perKit.map((p) => `${p.lotCode} ×${p.pouches}`).join(", ")} per kit)
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            Pick kits above. Single-color kits from one batch print that batch&apos;s code; multis and
            mixed kits get an MP code.
          </p>
        )}
        <input type="hidden" name="plan" value={JSON.stringify(plan)} />
        <input type="hidden" name="lots" value={JSON.stringify(lots.map((l) => l.id))} />
        <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Packed on</span>
            <input
              type="date"
              name="packedOn"
              defaultValue={today}
              required
              className="rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
            />
          </label>
          <button
            type="submit"
            disabled={recordBlocked || pending}
            className="rounded bg-lime-400 px-4 py-1.5 font-semibold text-black hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Recording…" : `Record ${kits} kits & print labels`}
          </button>
        </div>
        {allocError ? <p className="mt-2 text-sm text-red-300">{allocError}</p> : null}
        {state.error ? <p className="mt-2 text-sm text-red-300">{state.error}</p> : null}
      </form>
    </div>
  );
}

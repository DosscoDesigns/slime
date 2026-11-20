"use client";

import { useActionState, useMemo, useState } from "react";
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
import { recordPackRun, type ActionState } from "../lots-actions";

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
  initialOnHand,
  stock,
  stockConfigured,
  canRecord,
  nextRunNo,
  today,
}: {
  initialOnHand: Counts | null;
  stock: Record<string, FbaStock> | null;
  stockConfigured: boolean;
  canRecord: boolean;
  nextRunNo: number;
  today: string;
}) {
  const [onHand, setOnHand] = useState<Counts>(initialOnHand ?? ZERO);
  const [plan, setPlan] = useState<Plan>({});
  const [state, action, pending] = useActionState<ActionState, FormData>(recordPackRun, {
    error: null,
  });

  const left = useMemo(() => remaining(onHand, plan), [onHand, plan]);
  const options = useMemo(() => suggestPlans(onHand), [onHand]);
  const over = PACK_COLORS.filter((c) => left[c] < 0);
  const kits = PACK_VARIANTS.reduce((s, v) => s + (plan[v.id] ?? 0), 0);
  const unlabelled = PACK_VARIANTS.filter((v) => (plan[v.id] ?? 0) > 0 && !v.fnsku);
  const hasStock = PACK_COLORS.some((c) => onHand[c] > 0);
  const edited =
    initialOnHand !== null && PACK_COLORS.some((c) => onHand[c] !== initialOnHand[c]);
  const recordBlocked =
    !canRecord || kits === 0 || over.length > 0 || unlabelled.length > 0 || edited;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950">
        <div className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Pouches on hand</h2>
          <div className="flex flex-wrap gap-4">
            {PACK_COLORS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[c]}`} />
                <span className="w-14 text-zinc-400">{COLOR_LABEL[c]}</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={onHand[c] || ""}
                  onChange={(e) => setOnHand({ ...onHand, [c]: toInt(e.target.value) })}
                  className="w-20 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
                />
              </label>
            ))}
            {edited ? (
              <button
                type="button"
                onClick={() => setOnHand(initialOnHand!)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Reset to logged
              </button>
            ) : null}
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
              more pouches than you have.
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
        <h2 className="text-sm font-semibold text-zinc-300">Record packing run &amp; print labels</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Draws pouches from the oldest bulk lots first, saves which lots went into each kit, and
          opens the FBA labels for printing.
        </p>
        <input type="hidden" name="plan" value={JSON.stringify(plan)} />
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
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Run #</span>
            <input
              type="number"
              name="runNo"
              min="1"
              defaultValue={nextRunNo}
              required
              className="w-20 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
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
        {!canRecord ? (
          <p className="mt-2 text-xs text-zinc-500">
            Recording needs the traceability database, which isn&apos;t
            connected here yet.
          </p>
        ) : edited ? (
          <p className="mt-2 text-xs text-amber-200">
            You changed the pouch counts, so this is a what-if. Reset to logged to record, or log the
            missing batch first.
          </p>
        ) : null}
        {state.error ? <p className="mt-2 text-sm text-red-300">{state.error}</p> : null}
      </form>
    </div>
  );
}

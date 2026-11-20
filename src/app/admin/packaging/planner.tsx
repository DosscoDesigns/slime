"use client";

import { useMemo, useState } from "react";
import {
  PACK_COLORS,
  PACK_VARIANTS,
  pouchesPerKit,
  remaining,
  suggestPlans,
  type Counts,
  type Plan,
} from "@/lib/packaging";
import type { SlimeColor } from "@/lib/products";

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

export default function Planner() {
  const [onHand, setOnHand] = useState<Counts>(ZERO);
  const [plan, setPlan] = useState<Plan>({});

  const left = useMemo(() => remaining(onHand, plan), [onHand, plan]);
  const options = useMemo(() => suggestPlans(onHand), [onHand]);
  const over = PACK_COLORS.filter((c) => left[c] < 0);
  const kits = PACK_VARIANTS.reduce((s, v) => s + (plan[v.id] ?? 0), 0);
  const unlabelled = PACK_VARIANTS.filter((v) => (plan[v.id] ?? 0) > 0 && !v.fnsku);
  const hasStock = PACK_COLORS.some((c) => onHand[c] > 0);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
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
                  <span className="mt-1 block text-xs text-zinc-500">
                    Left over: {spare || "none"}
                  </span>
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
              <th className="px-4 py-2 font-medium">FNSKU</th>
              <th className="px-4 py-2 font-medium">Pouches / kit</th>
              <th className="px-4 py-2 text-right font-medium">Kits</th>
            </tr>
          </thead>
          <tbody>
            {PACK_VARIANTS.map((v) => (
              <tr key={v.id} className="border-t border-zinc-800">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
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
                <td className="px-4 py-2 font-mono text-xs">
                  {v.fnsku ?? <span className="text-amber-300">not on FBA yet</span>}
                </td>
                <td className="px-4 py-2 text-zinc-400">
                  {v.color ? pouchesPerKit(v) : `${pouchesPerKit(v) / 4} of each`}
                </td>
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
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
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
            Short on {over.map((c) => COLOR_LABEL[c].toLowerCase()).join(", ")} — this plan
            needs more pouches than you entered.
          </p>
        ) : null}
        {unlabelled.length > 0 ? (
          <p className="mt-2 text-amber-200">
            No FNSKU yet for {unlabelled.map((v) => v.name).join(", ")}. Set the listing to
            FBA in Seller Central before packing these for Amazon.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-600">
          Label printing comes next: once batches are tracked, this plan prints the FBA
          label with each kit&apos;s multipack lot.
        </p>
      </section>
    </div>
  );
}

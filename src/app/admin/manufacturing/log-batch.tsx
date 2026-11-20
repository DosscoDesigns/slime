"use client";

import { useActionState } from "react";
import { logBulkRun, type ActionState } from "../lots-actions";
import type { SlimeColor } from "@/lib/products";

const LABEL: Record<SlimeColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};
const CODE: Record<SlimeColor, string> = { red: "RD", yellow: "YL", green: "GR", blue: "BL" };

export default function LogBatch({
  colors,
  base,
  baseLbPerColor,
  nextRunNo,
  today,
}: {
  colors: { color: SlimeColor; estimate: number }[];
  base: "poly" | "malto";
  baseLbPerColor: number;
  nextRunNo: number;
  today: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logBulkRun, {
    error: null,
  });
  const yymmdd = (d: string) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);

  return (
    <form action={action} className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
      <h2 className="text-sm font-semibold text-zinc-300">Log this batch</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Creates one bulk lot per color ({yymmdd(today)}-{CODE[colors[0].color]}-
        {String(nextRunNo).padStart(2, "0")} and so on). Enter the pouches you actually
        filled.
      </p>
      <input type="hidden" name="base" value={base} />
      <input type="hidden" name="baseLbPerColor" value={baseLbPerColor.toFixed(2)} />

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">Made on</span>
          <input
            type="date"
            name="madeOn"
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
        {colors.map(({ color, estimate }) => (
          <label key={color} className="flex flex-col gap-1">
            <span className="text-zinc-400">{LABEL[color]} pouches</span>
            <input
              type="number"
              name={`pouches_${color}`}
              min="0"
              defaultValue={estimate}
              required
              className="w-20 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-zinc-400">Supplier lots (optional)</span>
          <input
            name="supplierLots"
            className="rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-zinc-400">Notes (optional)</span>
          <input name="notes" className="rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100" />
        </label>
      </div>

      {state.error ? <p className="mt-3 text-sm text-red-300">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
      >
        {pending ? "Logging…" : "Log batch"}
      </button>
    </form>
  );
}

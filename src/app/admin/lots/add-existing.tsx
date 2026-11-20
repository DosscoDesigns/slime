"use client";

import { useActionState } from "react";
import { logBulkRun, type ActionState } from "../lots-actions";
import { COLOR_ORDER } from "@/lib/manufacturing";

const LABEL = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" } as const;

/**
 * Pouches already filled but not logged (carryover from an earlier run).
 * They get the lot code of the run they were mixed in, so the lot still
 * follows the material; packing draws them first because they're oldest.
 */
export default function AddExisting({ nextRunNo, today }: { nextRunNo: number; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logBulkRun, {
    error: null,
  });

  return (
    <details className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
        Add pouches already on hand (carryover)
      </summary>
      <form action={action} className="mt-3">
        <p className="text-xs text-zinc-500">
          Use the date and run # these were mixed in, if you know them. If you don&apos;t, use the
          best date you have and the next free run # ({nextRunNo}). Then write the lot code on the
          bin so they stay with their lot.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Mixed on</span>
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
              required
              placeholder={String(nextRunNo)}
              className="w-20 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
            />
          </label>
          {COLOR_ORDER.map((c) => (
            <label key={c} className="flex flex-col gap-1">
              <span className="text-zinc-400">{LABEL[c]} pouches</span>
              <input
                type="number"
                name={`pouches_${c}`}
                min="0"
                defaultValue={0}
                className="w-20 rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
              />
            </label>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Notes</span>
          <input
            name="notes"
            defaultValue="Carryover, counted on hand"
            className="rounded border border-zinc-700 bg-black px-2 py-1.5 text-zinc-100"
          />
        </label>
        {state.error ? <p className="mt-3 text-sm text-red-300">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add to on hand"}
        </button>
      </form>
    </details>
  );
}

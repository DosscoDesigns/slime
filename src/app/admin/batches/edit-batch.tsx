"use client";

import { useActionState, useState } from "react";
import { editBatch, type ActionState } from "../lots-actions";

const LABEL = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" } as const;

export interface EditableLot {
  id: number;
  color: keyof typeof LABEL;
  lotCode: string;
  filled: number;
  used: number;
}

export default function EditBatch({ batchKey, lots }: { batchKey: string; lots: EditableLot[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, form) => {
      const r = await editBatch(prev, form);
      if (!r.error) setOpen(false);
      return r;
    },
    { error: null }
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-zinc-500 hover:text-lime-400">
        Edit
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 rounded border border-zinc-700 bg-black p-3 text-left">
      <p className="mb-2 text-xs text-zinc-400">
        Pouches filled in <span className="font-mono">{batchKey}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {lots.map((l) => (
          <label key={l.id} className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">{LABEL[l.color]}</span>
            <input
              type="number"
              name={`filled_${l.id}`}
              min={l.used}
              defaultValue={l.filled}
              required
              className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-sm text-zinc-100"
            />
            {l.used ? <span className="text-zinc-600">{l.used} packed</span> : null}
          </label>
        ))}
      </div>
      {state.error ? <p className="mt-2 text-xs text-red-300">{state.error}</p> : null}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-lime-400 px-3 py-1 text-xs font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
          Cancel
        </button>
      </div>
    </form>
  );
}

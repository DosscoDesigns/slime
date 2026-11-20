"use client";

import { useActionState } from "react";
import { sendToAmazon, type SendState } from "../lots-actions";

export default function SendButton({ runNo }: { runNo: number }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendToAmazon, {
    error: null,
    url: null,
  });
  if (state.url) {
    return (
      <a href={state.url} target="_blank" rel="noreferrer" className="text-sm text-lime-400 hover:text-lime-300">
        Draft created. Finish in Seller Central ↗
      </a>
    );
  }
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="runNo" value={runNo} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-lime-400/60 px-3 py-1 text-sm text-lime-300 hover:bg-lime-400/10 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Send to Amazon"}
      </button>
      {state.error ? <span className="max-w-xs text-right text-xs text-red-300">{state.error}</span> : null}
    </form>
  );
}

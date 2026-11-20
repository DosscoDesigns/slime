"use client";

import { useActionState } from "react";
import { cancelAmazonDraft, type SendState } from "../lots-actions";

export default function CancelButton({ runNo }: { runNo: number }) {
  const [state, action, pending] = useActionState<SendState, FormData>(cancelAmazonDraft, {
    error: null,
    url: null,
  });
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="runNo" value={runNo} />
      <button type="submit" disabled={pending} className="text-xs text-zinc-500 hover:text-red-300 disabled:opacity-50">
        {pending ? "Cancelling…" : "Cancel draft"}
      </button>
      {state.error ? <span className="max-w-xs text-right text-xs text-red-300">{state.error}</span> : null}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { refreshTracking } from "../../actions";

/**
 * Live carrier status.
 *
 * This exists as a client component for one reason: the order page is the ONLY
 * way to buy a label, and it must render even when Shippo is slow or down. If
 * the server component awaited a carrier lookup, a Shippo outage would take
 * fulfilment offline for the sake of a status line. So the server renders the
 * cached status instantly and this asks for a fresh one afterwards.
 *
 * Refreshing on mount and refreshing on the button are the same code path, so
 * the manual control is free.
 */
export default function LiveTracking({
  orderId,
  cachedStatus,
  terminal,
}: {
  orderId: string;
  cachedStatus: string | null;
  /** Already delivered/returned/failed — the parcel has stopped moving. */
  terminal: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const ranOnMount = useRef(false);

  async function refresh() {
    setState("loading");
    const res = await refreshTracking(orderId);
    setState(res.ok ? "idle" : "error");
    setMessage(res.message);
  }

  useEffect(() => {
    // Terminal states never change again, so asking would be pure waste.
    if (terminal || ranOnMount.current) return;
    ranOnMount.current = true;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={state === "loading"}
        className="rounded-full border border-zinc-700 px-3 py-1 font-semibold uppercase tracking-wider text-zinc-400 hover:border-lime-500 hover:text-lime-400 disabled:opacity-50"
      >
        {state === "loading" ? "Checking…" : "Refresh tracking"}
      </button>
      {state === "error" ? (
        <span className="text-amber-400">
          {message} — showing the last known status{cachedStatus ? "" : " (none yet)"}.
        </span>
      ) : message ? (
        <span className="text-zinc-500">{message}</span>
      ) : (
        <span className="text-zinc-600">Free — Shippo does not bill tracking on our labels.</span>
      )}
    </div>
  );
}

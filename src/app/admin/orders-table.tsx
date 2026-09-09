"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrderRowStatus } from "@/lib/orders";

/**
 * The orders table.
 *
 * A client component only so the filter can be instant. The server renders
 * EVERY row; filtering is pure presentation, so hiding a row must not cost a
 * server round-trip — and on this page a round-trip means re-reading Stripe.
 *
 * The chosen filter is mirrored into the URL with history.replaceState rather
 * than a router navigation: the link stays shareable and survives a refresh,
 * with no refetch, no <Suspense> boundary and no useSearchParams.
 */

export interface OrderRow {
  id: string;
  status: OrderRowStatus;
  /** Pre-formatted on the server so the table renders identically everywhere. */
  date: string;
  customer: string;
  items: string;
  total: string;
  refunded: string | null;
  tracking: { number: string; url: string; statusLabel: string | null } | null;
  delivery: string;
  needsAttention: boolean;
}

const STATUS_STYLE: Record<OrderRowStatus, { label: string; cls: string }> = {
  unfulfilled: { label: "Needs shipping", cls: "border-red-500/30 bg-red-500/15 text-red-300" },
  label_bought: { label: "Label bought", cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
  shipped: { label: "Shipped", cls: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
  in_transit: { label: "In transit", cls: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
  delivered: { label: "Delivered", cls: "border-lime-500/30 bg-lime-500/15 text-lime-300" },
  // Not successes. These two are the whole reason tracking is worth having.
  returned: { label: "Returned", cls: "border-orange-500/30 bg-orange-500/15 text-orange-300" },
  failed: { label: "Delivery failed", cls: "border-red-500/30 bg-red-500/15 text-red-300" },
  refunded: { label: "Refunded", cls: "border-zinc-600 bg-zinc-800 text-zinc-300" },
  cancelled: { label: "Cancelled", cls: "border-zinc-700 bg-zinc-900 text-zinc-500" },
};

type Filter = "open" | "all";

export default function OrdersTable({
  rows,
  defaultFilter,
}: {
  rows: OrderRow[];
  defaultFilter: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(defaultFilter);

  function choose(next: Filter) {
    setFilter(next);
    // replaceState, not push: the filter is a view preference, not a place. It
    // should not stack up in the back button.
    const url = new URL(window.location.href);
    if (next === "open") url.searchParams.delete("show");
    else url.searchParams.set("show", next);
    window.history.replaceState(null, "", url);
  }

  const openCount = rows.filter((r) => r.needsAttention).length;
  const visible = (r: OrderRow) => filter === "all" || r.needsAttention;
  const shown = rows.filter(visible).length;

  const tab =
    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
  const active = "border-lime-500/40 bg-lime-500/15 text-lime-300";
  const idle = "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-600">Show</span>
        <button type="button" onClick={() => choose("open")} className={`${tab} ${filter === "open" ? active : idle}`}>
          Needs attention · {openCount}
        </button>
        <button type="button" onClick={() => choose("all")} className={`${tab} ${filter === "all" ? active : idle}`}>
          All · {rows.length}
        </button>
      </div>

      {shown === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-8 text-center text-zinc-500">
          {filter === "open"
            ? "Nothing needs attention. Every order is delivered, cancelled or fully refunded."
            : "No paid orders yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell">Items</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">Tracking</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = STATUS_STYLE[r.status];
                return (
                  <tr
                    key={r.id}
                    hidden={!visible(r)}
                    className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40"
                  >
                    <td className="px-3 py-2">
                      <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.date}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${r.id}`} className="font-medium hover:text-lime-400">
                        {r.customer}
                      </Link>
                    </td>
                    <td className="hidden max-w-[22ch] truncate px-3 py-2 text-zinc-500 lg:table-cell">
                      {r.items}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                      {r.total}
                      {r.refunded ? (
                        <span className="block text-[11px] font-normal text-zinc-500">
                          −{r.refunded} refunded
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {r.tracking ? (
                        <a
                          href={r.tracking.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-lime-400"
                        >
                          {r.tracking.number}
                        </a>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-zinc-500 sm:table-cell">
                      {r.delivery}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

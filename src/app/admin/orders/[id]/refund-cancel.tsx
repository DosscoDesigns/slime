"use client";

import { useActionState, useState } from "react";
import { refundOrder, cancelOrder, uncancelOrder } from "../../actions";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Refunds and cancellation.
 *
 * Kept visually apart from the fulfilment panel, and from each other, for the
 * same reason quoting/buying/emailing are three buttons rather than one: these
 * move real money on a live Stripe account, and a control that is easy to press
 * by accident will eventually be pressed by accident.
 *
 * The amount is typed twice on purpose. A preselected "refund everything" button
 * is one misclick from giving away an order; typing the figure means the
 * operator has read it.
 */
export default function RefundAndCancel({
  orderId,
  nonce,
  refundableCents,
  refundedCents,
  disputed,
  cancelledAt,
  cancelledReason,
  refunds,
}: {
  orderId: string;
  nonce: string;
  refundableCents: number;
  refundedCents: number;
  disputed: boolean;
  cancelledAt: string | null;
  cancelledReason: string | null;
  refunds: Array<{
    id: string;
    amountCents: number;
    createdAt: string;
    status: string;
    reason: string | null;
  }>;
}) {
  const [refundState, refundAction, refunding] = useActionState(refundOrder, null);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelOrder, null);
  const [uncancelState, uncancelAction, uncancelling] = useActionState(uncancelOrder, null);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState("");

  const field =
    "w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-lime-500";
  const fullyRefunded = refundableCents === 0 && refundedCents > 0;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
        Money &amp; cancellation
      </h2>

      {/* Read live from Stripe every render — a refund issued in the Dashboard
          shows here without any sync. */}
      {refunds.length > 0 ? (
        <ul className="mb-4 space-y-1 text-sm">
          {refunds.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-400">
                {r.createdAt}
                {r.reason ? <span className="text-zinc-600"> · {r.reason}</span> : null}
              </span>
              <span className="whitespace-nowrap">
                <span className="font-semibold">−{money(r.amountCents)}</span>
                <span className="ml-2 text-xs text-zinc-600">{r.status}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mb-4 text-sm text-zinc-400">
        {refundedCents > 0 ? (
          <>
            <span className="font-semibold text-zinc-200">{money(refundedCents)}</span> refunded ·{" "}
          </>
        ) : null}
        <span className="font-semibold text-zinc-200">{money(refundableCents)}</span> still
        refundable
      </p>

      {disputed ? (
        <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          This charge is disputed. Handle it in the Stripe Dashboard — refunding a disputed
          charge here would fight with the dispute process.
        </p>
      ) : fullyRefunded ? (
        <p className="mb-4 text-sm text-zinc-500">Fully refunded — nothing left to return.</p>
      ) : (
        <form action={refundAction} className="mb-5 border-b border-zinc-800 pb-5">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="nonce" value={nonce} />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Amount
              </span>
              <input
                name="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={(refundableCents / 100).toFixed(2)}
                required
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Type it again
              </span>
              <input
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                inputMode="decimal"
                required
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Reason
              </span>
              <select name="reason" defaultValue="requested_by_customer" className={field}>
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={refunding || !amount || amount !== confirm}
            className="mt-3 rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-xs font-bold uppercase tracking-wider text-red-300 hover:border-red-500 disabled:opacity-40"
          >
            {refunding ? "Refunding…" : `Refund ${amount ? `$${amount}` : ""}`}
          </button>
          <span className="ml-3 text-xs text-zinc-600">
            Sends real money back. Partial amounts are fine.
          </span>
          {refundState?.message ? (
            <p className={`mt-3 text-sm ${refundState.ok ? "text-lime-400" : "text-red-400"}`}>
              {refundState.message}
            </p>
          ) : null}
        </form>
      )}

      {cancelledAt ? (
        <form action={uncancelAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <p className="mb-2 text-sm text-zinc-400">
            Cancelled {cancelledAt}
            {cancelledReason ? ` — ${cancelledReason}` : ""}.
          </p>
          <button
            type="submit"
            disabled={uncancelling}
            className="rounded-full border border-zinc-700 px-5 py-2 text-xs font-bold uppercase tracking-wider hover:border-lime-500 disabled:opacity-40"
          >
            {uncancelling ? "Reversing…" : "Un-cancel"}
          </button>
          {uncancelState?.message ? (
            <p className={`mt-3 text-sm ${uncancelState.ok ? "text-lime-400" : "text-red-400"}`}>
              {uncancelState.message}
            </p>
          ) : null}
        </form>
      ) : (
        <form action={cancelAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
              Reason
            </span>
            <input name="reason" placeholder="why this order is being cancelled" className={field} />
          </label>
          {!fullyRefunded ? (
            <label className="mt-2 flex items-start gap-2 text-xs text-zinc-500">
              <input type="checkbox" name="acknowledgeUnrefunded" className="mt-0.5 accent-lime-400" />
              <span>
                Cancel without refunding the {money(refundableCents)} still held. A cancelled
                order with the money still taken is the easiest thing in this system to
                forget about, so this is deliberately not the default.
              </span>
            </label>
          ) : null}
          <button
            type="submit"
            disabled={cancelling}
            className="mt-3 rounded-full border border-zinc-700 px-5 py-2 text-xs font-bold uppercase tracking-wider hover:border-red-500 hover:text-red-300 disabled:opacity-40"
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
          <span className="ml-3 text-xs text-zinc-600">
            Stops fulfilment. Reversible. Does not refund on its own.
          </span>
          {cancelState?.message ? (
            <p className={`mt-3 text-sm ${cancelState.ok ? "text-lime-400" : "text-red-400"}`}>
              {cancelState.message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";
import { quoteShipping, buyAndPrintLabel, emailCustomer } from "../../actions";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Fulfilment controls.
 *
 * Three separate buttons, never one "ship it": quoting is free, buying spends
 * real money and prints paper, and emailing is outbound to a customer. Each
 * is a decision, and collapsing them would make the expensive ones accidental.
 *
 * Dimensions and weight are typed in because the real per-tier weights are
 * still unknown — see scripts/ship-order.mjs for the same reasoning.
 */
export default function Fulfil({
  orderId,
  hasTracking,
  shippingChargedCents,
  cancelled,
}: {
  orderId: string;
  hasTracking: boolean;
  shippingChargedCents: number;
  /** Cancelled orders refuse every action below; the server enforces it too. */
  cancelled: boolean;
}) {
  const [quote, quoteAction, quoting] = useActionState(quoteShipping, null);
  const [buy, buyAction, buying] = useActionState(buyAndPrintLabel, null);
  const [mail, mailAction, mailing] = useActionState(emailCustomer, null);
  const [rateId, setRateId] = useState("");

  const field =
    "w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-lime-500";

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
        Fulfilment
      </h2>

      {cancelled ? (
        <p className="mb-4 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
          This order is cancelled. Quoting, buying a label and emailing the customer are all
          refused until it is un-cancelled.
        </p>
      ) : null}

      <form action={quoteAction} className="mb-4">
        <input type="hidden" name="orderId" value={orderId} />
        <div className="grid grid-cols-4 gap-2">
          {[
            ["length", "L in", "9"],
            ["width", "W in", "6"],
            ["height", "H in", "3"],
            ["weight", "lb", "1.44"],
          ].map(([name, label, placeholder]) => (
            <label key={name} className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                {label}
              </span>
              <input
                name={name}
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder={placeholder}
                className={field}
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={quoting || cancelled}
          className="mt-3 rounded-full border border-zinc-700 px-5 py-2 text-xs font-bold uppercase tracking-wider hover:border-lime-500 disabled:opacity-50"
        >
          {quoting ? "Quoting…" : "Get rates"}
        </button>
        <span className="ml-3 text-xs text-zinc-600">Costs nothing.</span>
      </form>

      {quote?.message ? (
        <p className={`mb-3 text-sm ${quote.ok ? "text-zinc-400" : "text-red-400"}`}>
          {quote.message}
        </p>
      ) : null}

      {quote?.rates?.length ? (
        <form action={buyAction} className="mb-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="rateId" value={rateId} />
          <ul className="mb-3 space-y-1">
            {quote.rates.map((r, i) => {
              const loss = shippingChargedCents - r.amountCents;
              return (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-800 px-3 py-2 text-sm hover:border-zinc-700">
                    <input
                      type="radio"
                      name="rate"
                      defaultChecked={i === 0}
                      onChange={() => setRateId(r.id)}
                      className="accent-lime-400"
                    />
                    <span className="flex-1">{r.label}</span>
                    <span className="text-xs text-zinc-500">{r.days ?? "?"}d</span>
                    <span className="font-semibold">{money(r.amountCents)}</span>
                    <span className={`w-16 text-right text-xs ${loss < 0 ? "text-red-400" : "text-lime-400"}`}>
                      {loss < 0 ? "-" : "+"}
                      {money(Math.abs(loss))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="submit"
            disabled={buying || hasTracking || cancelled}
            className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {buying ? "Buying…" : "Buy label + print"}
          </button>
          <span className="ml-3 text-xs text-zinc-600">
            {hasTracking ? "Already has a label." : "Spends money. Prints to the Zebra 4x6."}
          </span>
        </form>
      ) : null}

      {buy?.message ? (
        <p className={`mb-3 text-sm ${buy.ok ? "text-lime-400" : "text-red-400"}`}>{buy.message}</p>
      ) : null}

      <form action={mailAction} className="border-t border-zinc-800 pt-4">
        <input type="hidden" name="orderId" value={orderId} />
        <button
          type="submit"
          disabled={mailing || !hasTracking || cancelled}
          className="rounded-full border border-zinc-700 px-5 py-2 text-xs font-bold uppercase tracking-wider hover:border-lime-500 disabled:opacity-40"
        >
          {mailing ? "Sending…" : "Email customer tracking"}
        </button>
        <span className="ml-3 text-xs text-zinc-600">
          {hasTracking ? "Outbound to the customer." : "Needs a tracking number first."}
        </span>
      </form>
      {mail?.message ? (
        <p className={`mt-3 text-sm ${mail.ok ? "text-lime-400" : "text-red-400"}`}>{mail.message}</p>
      ) : null}
    </section>
  );
}

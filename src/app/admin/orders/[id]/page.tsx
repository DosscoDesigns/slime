import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getStripe, money } from "@/lib/admin-session";
import { getOrder } from "@/lib/orders";
import { CARRIERS } from "@/lib/carriers";
import { orderDurations, formatDuration } from "@/lib/delivery-stats";
import { isTerminal } from "@/lib/tracking";
import Fulfil from "./fulfil";
import LiveTracking from "./live-tracking";
import RefundAndCancel from "./refund-cancel";

export const dynamic = "force-dynamic";

export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const stripe = getStripe();
  const order = await getOrder(stripe, id);
  if (!order) notFound();

  // The itemised refund history is the ONE thing that needs an extra call —
  // charge.amount_refunded already gave us the summary for free. Never read
  // charge.refunds: it is optional on the Charge and recent API versions stop
  // populating it unless explicitly expanded.
  const refundList = order.chargeId
    ? (await stripe.refunds.list({ charge: order.chargeId, limit: 20 })).data
    : [];

  // A nonce the refund form echoes back, so a double-click, a back-button
  // resubmit and a React retry all reuse one Stripe idempotency key and cannot
  // issue a second refund. A deliberate second refund needs a fresh page load.
  const refundNonce = crypto.randomUUID();
  const durations = orderDurations(order);

  const addr = order.shipTo;
  const row = "flex justify-between py-1 text-sm";

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-lime-400">
        ← Orders
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {order.customerName ?? "(no name)"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {order.createdAt.toLocaleString()} · {money(order.amountCents)}
          {order.refund.amountRefundedCents > 0 ? (
            <span className="text-amber-400">
              {" "}
              · {money(order.refund.amountRefundedCents)} refunded
            </span>
          ) : null}
        </p>
        {order.cancelledAt ? (
          <p className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
            <strong className="text-zinc-200">Cancelled</strong>{" "}
            {order.cancelledAt.toLocaleString()}
            {order.cancelledReason ? ` — ${order.cancelledReason}` : ""}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
            Order
          </h2>
          {order.lines.map((l) => (
            <div key={l.name} className={row}>
              <span>
                {l.name} <span className="text-zinc-500">×{l.quantity}</span>
              </span>
              <span>{money(l.unitPriceCents * l.quantity)}</span>
            </div>
          ))}
          <div className="mt-3 border-t border-zinc-800 pt-2">
            <div className={row}>
              <span className="text-zinc-400">Subtotal</span>
              <span>{money(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 ? (
              <div className={row}>
                <span className="text-lime-400">
                  Discount {order.couponCode ? `(${order.couponCode})` : ""}
                </span>
                <span className="text-lime-400">-{money(order.discountCents)}</span>
              </div>
            ) : null}
            <div className={row}>
              <span className="text-zinc-400">Shipping charged</span>
              <span>{order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</span>
            </div>
            {order.taxCents > 0 ? (
              <div className={row}>
                <span className="text-zinc-400">FL tax</span>
                <span>{money(order.taxCents)}</span>
              </div>
            ) : null}
            <div className={`${row} border-t border-zinc-800 pt-2 font-bold`}>
              <span>Total</span>
              <span>{money(order.amountCents)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
            Ship to
          </h2>
          <address className="not-italic text-sm leading-relaxed">
            {order.customerName}
            <br />
            {addr?.line1}
            {addr?.line2 ? (
              <>
                <br />
                {addr.line2}
              </>
            ) : null}
            <br />
            {[addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", ")}
            <br />
            {addr?.country}
          </address>
          <p className="mt-3 break-all text-sm text-zinc-400">{order.customerEmail}</p>
          {order.customerPhone ? (
            <p className="text-sm text-zinc-400">{order.customerPhone}</p>
          ) : null}

          {order.tracking ? (
            <div className="mt-4 rounded-md border border-zinc-800 bg-black/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {CARRIERS[order.tracking.carrier].name} tracking
              </div>
              <a
                href={order.tracking.url}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-sm text-lime-400 underline decoration-lime-400/40 underline-offset-2 hover:decoration-lime-400"
              >
                {order.tracking.number}
              </a>
              {order.tracking.status ? (
                <div className="mt-1 text-xs text-zinc-400">
                  {order.tracking.status.replace(/_/g, " ")}
                  {order.tracking.statusAt
                    ? ` · ${order.tracking.statusAt.toLocaleString()}`
                    : ""}
                </div>
              ) : null}
              {order.tracking.etaAt && !order.tracking.deliveredAt ? (
                <div className="text-xs text-zinc-500">
                  ETA {order.tracking.etaAt.toLocaleDateString()}
                </div>
              ) : null}
              {order.tracking.deliveredAt ? (
                <div className="text-xs text-lime-400">
                  Delivered {order.tracking.deliveredAt.toLocaleString()}
                  {durations.totalHours !== null
                    ? ` · ${formatDuration(durations.totalHours)} door to door`
                    : ""}
                </div>
              ) : null}
              {durations.handlingHours !== null ? (
                <div className="text-xs text-zinc-600">
                  our handling {formatDuration(durations.handlingHours)}
                  {durations.transitHours !== null
                    ? ` · carrier ${formatDuration(durations.transitHours)}`
                    : ""}
                </div>
              ) : null}
              {order.shippingCostCents != null ? (
                <div className="mt-1 text-xs text-zinc-500">
                  postage {money(order.shippingCostCents)} · charged{" "}
                  {money(order.shippingCents)} ·{" "}
                  <span
                    className={
                      order.shippingCents - order.shippingCostCents < 0
                        ? "text-red-400"
                        : "text-lime-400"
                    }
                  >
                    {money(order.shippingCents - order.shippingCostCents)}
                  </span>
                </div>
              ) : null}
              <div className="mt-1 text-xs text-zinc-500">
                {order.shippingEmailSentAt
                  ? `customer emailed ${order.shippingEmailSentAt.toLocaleString()}`
                  : "customer NOT yet emailed"}
              </div>
              <LiveTracking
                orderId={order.id}
                cachedStatus={order.tracking.status}
                terminal={isTerminal(order.tracking.status)}
              />
            </div>
          ) : null}

          {order.receiptUrl ? (
            <a
              href={order.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-zinc-500 underline hover:text-lime-400"
            >
              Stripe receipt
            </a>
          ) : null}
        </section>
      </div>

      <div className="mt-4 space-y-4">
        <Fulfil
          orderId={order.id}
          hasTracking={Boolean(order.tracking)}
          shippingChargedCents={order.shippingCents}
          cancelled={Boolean(order.cancelledAt)}
        />
        <RefundAndCancel
          orderId={order.id}
          nonce={refundNonce}
          refundableCents={order.refund.refundableCents}
          refundedCents={order.refund.amountRefundedCents}
          disputed={order.refund.disputed}
          cancelledAt={order.cancelledAt?.toLocaleString() ?? null}
          cancelledReason={order.cancelledReason}
          refunds={refundList.map((r) => ({
            id: r.id,
            amountCents: r.amount,
            createdAt: new Date(r.created * 1000).toLocaleString(),
            status: r.status ?? "unknown",
            reason: r.reason ?? null,
          }))}
        />
      </div>

      <p className="mt-6 text-center font-mono text-xs text-zinc-700">{order.id}</p>
    </main>
  );
}

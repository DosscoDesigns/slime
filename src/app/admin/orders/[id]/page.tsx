import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getStripe, money } from "@/lib/admin-session";
import { getOrder } from "@/lib/orders";
import Fulfil from "./fulfil";

export const dynamic = "force-dynamic";

export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrder(getStripe(), id);
  if (!order) notFound();

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
        </p>
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

          {order.trackingNumber ? (
            <div className="mt-4 rounded-md border border-zinc-800 bg-black/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Tracking
              </div>
              <div className="break-all font-mono text-sm">{order.trackingNumber}</div>
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

      <div className="mt-4">
        <Fulfil
          orderId={order.id}
          hasTracking={Boolean(order.trackingNumber)}
          shippingChargedCents={order.shippingCents}
        />
      </div>

      <p className="mt-6 text-center font-mono text-xs text-zinc-700">{order.id}</p>
    </main>
  );
}

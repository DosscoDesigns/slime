import Link from "next/link";
import { requireAdmin, getStripe, money } from "@/lib/admin-session";
import { listOrders, rowStatus } from "@/lib/orders";
import { deliveryStats, orderDurations, formatDuration } from "@/lib/delivery-stats";
import { CARRIERS } from "@/lib/carriers";
import OrdersTable, { type OrderRow } from "./orders-table";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_WORD: Record<string, string> = {
  pre_transit: "label created",
  transit: "in transit",
  delivered: "delivered",
  returned: "returned",
  failure: "failed",
  unknown: "unknown",
};

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireAdmin();
  const [orders, { show }] = await Promise.all([
    listOrders(getStripe()),
    searchParams,
  ]);

  // Every total below is computed over ALL orders, never the filtered view. The
  // default filter hides delivered and cancelled orders, so filtering first
  // would quietly turn "revenue" into "revenue from unfinished orders".
  const needing = orders.filter((o) => o.needsAttention).length;
  const gross = orders.reduce((s, o) => s + o.amountCents, 0);
  const refunded = orders.reduce((s, o) => s + o.refund.amountRefundedCents, 0);
  const postage = orders.reduce((s, o) => s + (o.shippingCostCents ?? 0), 0);
  const shipCharged = orders.reduce((s, o) => s + o.shippingCents, 0);
  const stats = deliveryStats(orders);

  const rows: OrderRow[] = orders.map((o) => {
    const d = orderDurations(o);
    return {
      id: o.id,
      status: rowStatus(o),
      date: o.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      customer: o.customerName ?? "(no name)",
      items: o.lines.map((l) => `${l.name} ×${l.quantity}`).join(", ") || "—",
      total: money(o.amountCents),
      refunded: o.refund.amountRefundedCents > 0 ? money(o.refund.amountRefundedCents) : null,
      tracking: o.tracking
        ? {
            number: o.tracking.number,
            url: o.tracking.url,
            statusLabel: o.tracking.status
              ? `${CARRIERS[o.tracking.carrier].name} · ${STATUS_WORD[o.tracking.status] ?? o.tracking.status}`
              : null,
          }
        : null,
      delivery: d.totalHours !== null ? formatDuration(d.totalHours) : "—",
      needsAttention: o.needsAttention,
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {orders.length} paid · {needing} needing attention · {money(gross)} gross
            {refunded > 0 ? (
              <>
                {" "}
                · <span className="text-zinc-400">{money(gross - refunded)} net</span> after{" "}
                {money(refunded)} refunded
              </>
            ) : null}
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/coupons" className="text-zinc-400 hover:text-lime-400">
            Coupons
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-zinc-500 hover:text-zinc-300">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {postage > 0 ? (
        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
          <span className="text-zinc-400">Shipping charged </span>
          <span className="font-semibold">{money(shipCharged)}</span>
          <span className="text-zinc-400"> · postage paid </span>
          <span className="font-semibold">{money(postage)}</span>
          <span className="text-zinc-400"> · margin </span>
          <span
            className={
              shipCharged - postage < 0 ? "font-semibold text-red-400" : "font-semibold text-lime-400"
            }
          >
            {money(shipCharged - postage)}
          </span>
          <span className="text-zinc-600"> (orders with a bought label only)</span>
        </div>
      ) : null}

      {stats.n > 0 ? (
        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
          <span className="text-zinc-400">Median delivery </span>
          <span className="font-semibold">{formatDuration(stats.medianTotalHours)}</span>
          <span className="text-zinc-600"> = </span>
          <span className="text-zinc-400">our handling </span>
          <span className="font-semibold">{formatDuration(stats.medianHandlingHours)}</span>
          <span className="text-zinc-600"> + </span>
          <span className="text-zinc-400">carrier transit </span>
          <span className="font-semibold">{formatDuration(stats.medianTransitHours)}</span>
          <span className="text-zinc-600">
            {" "}
            · medians over {stats.n} delivered order{stats.n === 1 ? "" : "s"}
            {stats.n < 5 ? " (too few to be a statistic yet)" : ""}
          </span>
        </div>
      ) : null}

      <OrdersTable rows={rows} defaultFilter={show === "all" ? "all" : "open"} />
    </main>
  );
}

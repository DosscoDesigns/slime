import Link from "next/link";
import { requireAdmin, getStripe, money } from "@/lib/admin-session";
import { listOrders, type Order } from "@/lib/orders";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const STATE_STYLE: Record<Order["state"], { label: string; cls: string }> = {
  unfulfilled: { label: "Needs shipping", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  label_bought: { label: "Label bought", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  shipped: { label: "Shipped", cls: "bg-lime-500/15 text-lime-300 border-lime-500/30" },
};

export default async function AdminOrders() {
  await requireAdmin();
  const orders = await listOrders(getStripe());

  const needing = orders.filter((o) => o.state !== "shipped").length;
  const revenue = orders.reduce((s, o) => s + o.amountCents, 0);
  const postage = orders.reduce((s, o) => s + (o.shippingCostCents ?? 0), 0);
  const shipCharged = orders.reduce((s, o) => s + o.shippingCents, 0);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {orders.length} paid · {needing} needing attention · {money(revenue)} gross
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
        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
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

      {orders.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-8 text-center text-zinc-500">
          No paid orders yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const s = STATE_STYLE[o.state];
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 hover:border-zinc-700"
                >
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {o.customerName ?? "(no name)"}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {o.lines.map((l) => `${l.name} ×${l.quantity}`).join(", ") || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{money(o.amountCents)}</span>
                    <span className="block text-xs text-zinc-500">
                      {o.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

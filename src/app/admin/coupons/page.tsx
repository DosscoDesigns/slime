import Link from "next/link";
import { requireAdmin, getStripe, money } from "@/lib/admin-session";
import { listCouponsWithUsage } from "@/lib/coupon-admin";

export const dynamic = "force-dynamic";

export default async function AdminCoupons() {
  await requireAdmin();
  const coupons = await listCouponsWithUsage(getStripe());

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-lime-400">
        ← Orders
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Coupons</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Usage is read live from Stripe — a code counts as used only once a
          payment actually succeeded.
        </p>
      </header>

      <ul className="space-y-2">
        {coupons.map((c) => (
          <li
            key={c.code}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-lime-400">
                {c.code}
              </span>
              <span className="text-sm text-zinc-400">{c.label}</span>
              {c.singleUse ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    c.spent
                      ? "border-red-500/30 bg-red-500/15 text-red-300"
                      : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {c.spent ? "single-use · SPENT" : "single-use · unused"}
                </span>
              ) : null}
              <span className="ml-auto text-sm">
                {c.timesRedeemed} used
                {c.totalDiscountCents > 0 ? (
                  <span className="text-zinc-500"> · {money(c.totalDiscountCents)} given</span>
                ) : null}
              </span>
            </div>
            {c.minSubtotalCents ? (
              <p className="mt-1 text-xs text-zinc-500">
                Needs a subtotal of {money(c.minSubtotalCents)} or more.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/*
        Being explicit rather than implying an editor exists. Codes live in
        src/lib/coupons.ts and adding one is a deploy — moving them into the
        Supabase project is the next step, and it touches the live checkout
        path, so it is not a thing to do quietly.
      */}
      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
        <strong className="text-zinc-200">Read-only for now.</strong> Codes are
        defined in <code className="text-zinc-300">src/lib/coupons.ts</code>, so
        creating or retiring one is a code change and a deploy. Moving them into
        the database is the next step — it changes the live checkout path, so it
        needs a deliberate release rather than a quiet one.
      </div>
    </main>
  );
}

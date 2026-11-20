import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, listBatches, type Batch } from "@/lib/traceability";
import { amazonConfigured, fbaStockByFnsku, type FbaStock } from "@/lib/amazon-inventory";
import { PACK_COLORS } from "@/lib/packaging";
import { logError, errorContext } from "@/lib/logger";
import Planner, { type PlannerBatch } from "./planner";

export const dynamic = "force-dynamic";

const toPlanner = (b: Batch): PlannerBatch => ({
  key: b.key,
  madeOn: b.madeOn,
  remaining: b.remaining,
  lots: PACK_COLORS.flatMap((c) => {
    const l = b.lots[c];
    return l && l.pouchesRemaining > 0
      ? [{ id: l.id, lotCode: l.lotCode, color: c, madeOn: l.madeOn, remaining: l.pouchesRemaining }]
      : [];
  }),
});

export default async function Packaging({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  await requireAdmin();
  const { batch } = await searchParams;

  const db = traceabilityConfigured();
  const [batches, stock] = await Promise.all([
    db ? listBatches() : Promise.resolve<Batch[]>([]),
    amazonConfigured()
      ? fbaStockByFnsku().catch((e) => {
          logError("admin.fba_stock_failed", errorContext(e));
          return null;
        })
      : Promise.resolve<Record<string, FbaStock> | null>(null),
  ]);
  const open = batches.map(toPlanner).filter((b) => b.lots.length > 0);
  // Default to the batch just logged (or clicked); otherwise the newest with pouches left.
  const start = open.find((b) => b.key === batch)?.key ?? open[0]?.key ?? null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">New package</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Packs from the batch you just mixed. Add another batch only to use up its leftovers.
        </p>
      </header>
      {!db ? (
        <p className="text-sm text-zinc-500">The batch database isn&apos;t connected here yet.</p>
      ) : (
        <Planner
          batches={open}
          initialBatch={start}
          stock={stock}
          stockConfigured={amazonConfigured()}
          today={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
        />
      )}
    </main>
  );
}

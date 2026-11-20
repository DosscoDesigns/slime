import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, onHandByColor, nextPackRunNo } from "@/lib/traceability";
import { amazonConfigured, fbaStockByFnsku, type FbaStock } from "@/lib/amazon-inventory";
import type { Counts } from "@/lib/packaging";
import { logError, errorContext } from "@/lib/logger";
import Planner from "./planner";

export const dynamic = "force-dynamic";

export default async function Packaging() {
  await requireAdmin();

  const db = traceabilityConfigured();
  const [onHand, nextRunNo, stock] = await Promise.all([
    db ? onHandByColor() : Promise.resolve<Counts | null>(null),
    db ? nextPackRunNo() : Promise.resolve(1),
    amazonConfigured()
      ? fbaStockByFnsku().catch((e) => {
          logError("admin.fba_stock_failed", errorContext(e));
          return null;
        })
      : Promise.resolve<Record<string, FbaStock> | null>(null),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Packaging planner</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {onHand
            ? "Pouches on hand come from logged batches, less what's already been packed. "
            : "Enter the pouches you have of each color. "}
          Pick a starting plan, adjust the kit counts, then record the run to print labels.
        </p>
      </header>
      <Planner
        initialOnHand={onHand}
        stock={stock}
        stockConfigured={amazonConfigured()}
        canRecord={db}
        nextRunNo={nextRunNo}
        today={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
      />
    </main>
  );
}

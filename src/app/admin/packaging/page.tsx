import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, listPackLots } from "@/lib/traceability";
import { amazonConfigured } from "@/lib/amazon-inventory";
import { inboundByPackRun, type InboundStatus } from "@/lib/amazon-inbound";
import { PACK_VARIANTS } from "@/lib/packaging";
import { logError, errorContext } from "@/lib/logger";
import SendButton from "./send-button";
import CancelButton from "./cancel-button";

export const dynamic = "force-dynamic";

const VARIANT_NAME = Object.fromEntries(PACK_VARIANTS.map((v) => [v.id, v.name]));

const SHIPMENT_STATUS: Record<string, string> = {
  ABANDONED: "Abandoned",
  CANCELLED: "Cancelled",
  CHECKED_IN: "Checked in",
  CLOSED: "Closed (received)",
  DELETED: "Deleted",
  DELIVERED: "Delivered",
  IN_TRANSIT: "In transit",
  MIXED: "Mixed",
  READY_TO_SHIP: "Ready to ship",
  RECEIVING: "Receiving",
  SHIPPED: "Shipped",
  UNCONFIRMED: "Unconfirmed",
  WORKING: "Working",
};

function AmazonStatus({ s, runNo }: { s: InboundStatus; runNo: number }) {
  return (
    <div className="text-right text-sm">
      <a href={s.url} target="_blank" rel="noreferrer" className="text-lime-400 hover:text-lime-300">
        {s.status === "SHIPPED" ? "Shipped" : "At Amazon: draft"} ↗
      </a>
      {s.shipments.length > 0 ? (
        <ul className="mt-1 text-xs text-zinc-400">
          {s.shipments.map((x) => (
            <li key={x.shipmentId}>
              <span className="font-mono">{x.shipmentId}</span> · {SHIPMENT_STATUS[x.status] ?? x.status}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">Pick placement &amp; shipping in Seller Central.</p>
      )}
      {s.status === "ACTIVE" && s.shipments.every((x) => x.status === "WORKING" || x.status === "UNCONFIRMED") ? (
        <CancelButton runNo={runNo} />
      ) : null}
    </div>
  );
}

export default async function Packages() {
  await requireAdmin();
  if (!traceabilityConfigured()) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Packages</h1>
        <p className="mt-3 text-sm text-zinc-500">The batch database isn&apos;t connected here yet.</p>
      </main>
    );
  }

  const amazon = amazonConfigured();
  const [packs, inbound] = await Promise.all([
    listPackLots(),
    amazon
      ? inboundByPackRun().catch((e) => {
          logError("admin.inbound_status_failed", errorContext(e));
          return null;
        })
      : Promise.resolve(null),
  ]);
  const runs = [...new Set(packs.map((p) => p.runNo))];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Packages</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every packing run: print its labels, send it to Amazon, and follow the shipment.
          </p>
        </div>
        <Link
          href="/admin/packaging/new"
          className="rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300"
        >
          New package
        </Link>
      </header>

      {amazon && inbound === null ? (
        <p className="mb-4 text-xs text-amber-200">Couldn&apos;t reach Amazon for shipment status; reload to retry.</p>
      ) : null}

      {runs.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing packed yet.</p>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const rows = packs.filter((p) => p.runNo === run);
            const kits = rows.reduce((s, r) => s + r.kits, 0);
            const status = inbound?.[run];
            return (
              <div key={run} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      Package #{run} <span className="font-normal text-zinc-500">· packed {rows[0].packedOn} · {kits} kits</span>
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {rows.map((r) => (
                        <li key={r.id}>
                          <span className="font-semibold">{r.kits}×</span> {VARIANT_NAME[r.variantId] ?? r.variantId} →{" "}
                          <span className="font-mono text-lime-400">{r.lotCode}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/admin/labels/${run}`}
                      className="rounded border border-zinc-700 px-3 py-1 text-sm hover:border-lime-400"
                    >
                      Labels
                    </Link>
                    {status ? <AmazonStatus s={status} runNo={run} /> : amazon && inbound ? <SendButton runNo={run} /> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

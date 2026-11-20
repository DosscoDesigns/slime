import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, listBatches, listPackLots } from "@/lib/traceability";
import { PACK_COLORS, PACK_VARIANTS } from "@/lib/packaging";

export const dynamic = "force-dynamic";

const VARIANT_NAME = Object.fromEntries(PACK_VARIANTS.map((v) => [v.id, v.name]));
const COLOR_LABEL = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" } as const;
const DOT = { red: "bg-red-500", yellow: "bg-yellow-400", green: "bg-lime-500", blue: "bg-sky-500" } as const;

export default async function Batches({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;

  if (!traceabilityConfigured()) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Batches</h1>
        <p className="mt-3 text-sm text-zinc-500">The batch database isn&apos;t connected here yet.</p>
      </main>
    );
  }

  const [batches, packs] = await Promise.all([listBatches(), listPackLots()]);
  const needle = q?.trim().toUpperCase();
  const packMatches = needle
    ? packs.filter((p) => p.lotCode.includes(needle) || p.components.some((c) => c.lotCode.includes(needle)))
    : packs;
  const batchMatches = needle
    ? batches.filter(
        (b) => b.key.includes(needle) || Object.values(b.lots).some((l) => l!.lotCode.includes(needle))
      )
    : batches;
  const runs = [...new Set(packMatches.map((p) => p.runNo))];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Batches</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pouches on hand from each mixing run. Search a batch or label code to trace it.
          </p>
        </div>
        <form method="get" className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="261120-RD-41 or MP-…"
            className="w-52 rounded border border-zinc-700 bg-black px-2 py-1.5 font-mono text-zinc-100"
          />
          <button type="submit" className="rounded border border-zinc-700 px-3 py-1.5 hover:border-lime-400">
            Trace
          </button>
        </form>
      </header>

      <section className="mb-8 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-left text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Batch</th>
              <th className="px-4 py-2 font-medium">Mixed</th>
              {PACK_COLORS.map((c) => (
                <th key={c} className="px-3 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${DOT[c]}`} />
                    {COLOR_LABEL[c]}
                  </span>
                </th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {batchMatches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-zinc-500">
                  {needle ? "No batches match." : "No batches yet. Mix one and log its pouches."}
                </td>
              </tr>
            ) : (
              batchMatches.map((b) => {
                const left = PACK_COLORS.reduce((s, c) => s + b.remaining[c], 0);
                return (
                  <tr key={b.key} className={`border-t border-zinc-800 ${left ? "" : "text-zinc-600"}`}>
                    <td className="px-4 py-2 font-mono font-semibold">{b.key}</td>
                    <td className="px-4 py-2 text-zinc-400">{b.madeOn}</td>
                    {PACK_COLORS.map((c) => {
                      const l = b.lots[c];
                      return (
                        <td key={c} className="px-3 py-2 text-right" title={l?.lotCode}>
                          {l ? (
                            <>
                              <span className={l.pouchesRemaining ? "font-semibold" : ""}>{l.pouchesRemaining}</span>
                              <span className="text-xs text-zinc-600"> / {l.pouchesFilled}</span>
                            </>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right">
                      {left ? (
                        <Link
                          href={`/admin/packaging?batch=${b.key}`}
                          className="text-lime-400 hover:text-lime-300"
                        >
                          Package →
                        </Link>
                      ) : (
                        <span className="text-xs">all packed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          On hand / filled. Hover a count for its lot code (e.g. 261120-RD-41).
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Packed</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing packed{needle ? " matches" : " yet"}.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const rows = packMatches.filter((p) => p.runNo === run);
              return (
                <div key={run} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-300">Packed {rows[0].packedOn}</span>
                    <Link
                      href={`/admin/labels/${run}`}
                      className="ml-auto text-sm text-zinc-400 hover:text-lime-400"
                    >
                      Labels →
                    </Link>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.id}>
                        <span className="font-semibold">{r.kits}×</span> {VARIANT_NAME[r.variantId] ?? r.variantId}{" "}
                        → <span className="font-mono text-lime-400">{r.lotCode}</span>
                        {r.lotCode.startsWith("MP-") ? (
                          <span className="block text-xs text-zinc-500">
                            holds {r.components.map((c) => `${c.lotCode} ×${c.pouches / r.kits}`).join(", ")} per kit
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

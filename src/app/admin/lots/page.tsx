import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, listBulkLots, listPackLots } from "@/lib/traceability";
import { PACK_VARIANTS } from "@/lib/packaging";

export const dynamic = "force-dynamic";

const VARIANT_NAME = Object.fromEntries(PACK_VARIANTS.map((v) => [v.id, v.name]));
const DOT: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-lime-500",
  blue: "bg-sky-500",
};

export default async function Lots({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string; q?: string }>;
}) {
  await requireAdmin();
  const { logged, q } = await searchParams;

  if (!traceabilityConfigured()) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Lots</h1>
        <p className="mt-3 text-sm text-zinc-500">
          The traceability database (SLIME_DATABASE_URL) isn&apos;t connected here yet.
        </p>
      </main>
    );
  }

  const [bulk, packs] = await Promise.all([listBulkLots(), listPackLots()]);
  const needle = q?.trim().toUpperCase();
  const packMatches = needle
    ? packs.filter(
        (p) =>
          p.lotCode.includes(needle) || p.components.some((c) => c.lotCode.includes(needle))
      )
    : packs;
  const bulkMatches = needle ? bulk.filter((b) => b.lotCode.includes(needle)) : bulk;
  const runs = [...new Set(packMatches.map((p) => p.lotCode))];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lots</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Supplier lot → bulk color lot → pack lot. Search either kind of lot to trace it.
          </p>
        </div>
        <form method="get" className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="261030-YL-42 or MP-…"
            className="w-52 rounded border border-zinc-700 bg-black px-2 py-1.5 font-mono text-zinc-100"
          />
          <button type="submit" className="rounded border border-zinc-700 px-3 py-1.5 hover:border-lime-400">
            Trace
          </button>
        </form>
      </header>

      {logged ? (
        <p className="mb-4 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm text-lime-200">
          Logged {logged.split(",").join(", ")}.
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Pack runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No packing runs recorded{needle ? " match" : " yet"}.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((code) => {
              const rows = packMatches.filter((p) => p.lotCode === code);
              return (
                <div key={code} className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-semibold text-lime-400">{code}</span>
                    <span className="text-sm text-zinc-500">
                      {rows[0].packedOn}
                      {rows[0].packedBy ? ` · ${rows[0].packedBy}` : ""}
                    </span>
                    <Link
                      href={`/admin/labels/${encodeURIComponent(code)}`}
                      className="ml-auto text-sm text-zinc-400 hover:text-lime-400"
                    >
                      Labels →
                    </Link>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.id}>
                        <span className="font-semibold">{r.kits}×</span>{" "}
                        {VARIANT_NAME[r.variantId] ?? r.variantId}{" "}
                        <span className="font-mono text-xs text-zinc-500">{r.fnsku}</span>
                        <span className="block text-xs text-zinc-500">
                          from{" "}
                          {r.components.map((c) => `${c.lotCode} ×${c.pouches}`).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Bulk lots</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-left text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Lot</th>
                <th className="px-4 py-2 font-medium">Made</th>
                <th className="px-4 py-2 text-right font-medium">Filled</th>
                <th className="px-4 py-2 text-right font-medium">Packed</th>
                <th className="px-4 py-2 text-right font-medium">Left</th>
                <th className="px-4 py-2 font-medium">Supplier lots / notes</th>
              </tr>
            </thead>
            <tbody>
              {bulkMatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-zinc-500">
                    No bulk lots{needle ? " match" : " logged yet — log one from Manufacturing"}.
                  </td>
                </tr>
              ) : (
                bulkMatches.map((b) => (
                  <tr key={b.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 font-mono">
                        <span className={`h-2.5 w-2.5 rounded-full ${DOT[b.color]}`} />
                        {b.lotCode}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{b.madeOn}</td>
                    <td className="px-4 py-2 text-right">{b.pouchesFilled}</td>
                    <td className="px-4 py-2 text-right text-zinc-400">{b.pouchesUsed}</td>
                    <td className="px-4 py-2 text-right font-semibold">{b.pouchesRemaining}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {[b.supplierLots, b.notes].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

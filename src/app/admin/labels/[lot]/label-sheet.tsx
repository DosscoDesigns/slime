"use client";

import { useState } from "react";

export interface LabelItem {
  key: string;
  /** Printed on the label: a bulk lot (261120-RD-41) or an MP code. */
  lotCode: string;
  variantId: string;
  name: string;
  title: string;
  fnsku: string;
  kits: number;
  /** Code 128 SVG rendered server-side from a validated FNSKU. */
  svg: string;
}

// DYMO 30334: 2¼" × 1¼". One label per printed page; pick the 30334 paper
// size in the print dialog and set margins to none.
const PAGE_CSS = `
@page { size: 2.25in 1.25in; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .fba-label { break-after: page; }
  .fba-label:last-child { break-after: auto; }
}
.fba-label svg { width: 100%; height: 100%; display: block; }
`;

export default function LabelSheet({
  packedOn,
  items,
}: {
  packedOn: string;
  items: LabelItem[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.key, i.kits]))
  );
  const total = items.reduce((s, i) => s + (counts[i.key] ?? 0), 0);

  return (
    <>
      <style>{PAGE_CSS}</style>
      <main className="mx-auto max-w-4xl px-5 py-10 print:m-0 print:max-w-none print:p-0">
        <header className="mb-6 print:hidden">
          <h1 className="text-2xl font-extrabold tracking-tight">
            FBA labels · packed {packedOn}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            One label per kit by default; change a count to reprint. In the print
            dialog choose the DYMO, paper size <b>30334</b>, margins <b>none</b>, scale 100%.
          </p>
          <div className="mt-4 space-y-2">
            {items.map((i) => (
              <label key={i.key} className="flex items-center gap-3 text-sm">
                <input
                  type="number"
                  min="0"
                  value={counts[i.key] ?? 0}
                  onChange={(e) =>
                    setCounts({ ...counts, [i.key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                  }
                  className="w-20 rounded border border-zinc-700 bg-black px-2 py-1 text-right text-zinc-100"
                />
                <span>{i.name}</span>
                <span className="font-mono text-xs text-lime-400">{i.lotCode}</span>
                <span className="font-mono text-xs text-zinc-500">{i.fnsku}</span>
                <span className="text-xs text-zinc-600">(packed {i.kits})</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={total === 0}
            className="mt-4 rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40"
          >
            Print {total} labels
          </button>
          <p className="mt-6 text-xs text-zinc-500">Preview:</p>
        </header>

        <div className="flex flex-wrap gap-3 print:block">
          {items.flatMap((i) =>
            Array.from({ length: counts[i.key] ?? 0 }, (_, n) => (
              <div
                key={`${i.key}-${n}`}
                className="fba-label flex flex-col overflow-hidden bg-white text-black"
                style={{
                  width: "2.25in",
                  height: "1.25in",
                  padding: "0.07in 0.1in 0.05in",
                  boxSizing: "border-box",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <div style={{ height: "0.42in" }} dangerouslySetInnerHTML={{ __html: i.svg }} />
                <div style={{ fontSize: "8pt", textAlign: "center", letterSpacing: "0.04em", marginTop: "0.02in" }}>
                  {i.fnsku}
                </div>
                <div
                  style={{
                    fontSize: "6pt",
                    lineHeight: 1.15,
                    marginTop: "0.03in",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {i.title}
                </div>
                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "6.5pt",
                    fontWeight: 700,
                  }}
                >
                  <span>New</span>
                  <span>Lot {i.lotCode}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}

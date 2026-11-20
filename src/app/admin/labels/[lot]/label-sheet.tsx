"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { parseBrowserPrintDevice } from "@/lib/browser-print";
import { printFbaLabels, fbaLabelZplFor, type PrintState } from "../../lots-actions";

// Zebra Browser Print: Zebra's free helper app on the Mac, which hands ZPL to a
// USB (or network) Zebra. Chrome lets an https page talk to it on loopback.
const BROWSER_PRINT = "http://127.0.0.1:9100";

const TEXT = { "Content-Type": "text/plain;charset=UTF-8" };

async function printViaBrowserPrint(zpl: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BROWSER_PRINT}/default?type=printer`, { headers: TEXT });
  } catch {
    throw new Error(
      "Couldn't reach Zebra Browser Print on this computer. Install it from zebra.com, make sure it's running, and use Chrome."
    );
  }
  const device = parseBrowserPrintDevice(res.ok ? await res.text() : "");
  if (!device) {
    throw new Error("Zebra Browser Print has no default printer. Open it and choose the Zebra.");
  }
  const write = await fetch(`${BROWSER_PRINT}/write`, {
    method: "POST",
    headers: TEXT,
    body: JSON.stringify({ device, data: zpl }),
  });
  if (!write.ok) {
    const why = (await write.text().catch(() => "")).trim().slice(0, 200);
    throw new Error(
      `Zebra Browser Print refused the job (${write.status}${why ? `: ${why}` : ""}) — printer "${device.name}" via ${device.connection || "unknown connection"}.`
    );
  }
}

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
  runNo,
  packedOn,
  items,
}: {
  runNo: number;
  packedOn: string;
  items: LabelItem[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.key, i.kits]))
  );
  const total = items.reduce((s, i) => s + (counts[i.key] ?? 0), 0);
  const [zebra, sendToZebra, sending] = useActionState<PrintState, FormData>(printFbaLabels, {
    error: null,
    printed: null,
  });
  const [local, setLocal] = useState<{ busy: boolean; msg: string | null; error: string | null }>({
    busy: false,
    msg: null,
    error: null,
  });

  const zplForm = () => {
    const f = new FormData();
    f.set("runNo", String(runNo));
    for (const i of items) f.set(`count_${i.key}`, String(counts[i.key] ?? 0));
    return f;
  };
  const getZpl = async () => {
    const r = await fbaLabelZplFor(zplForm());
    if ("error" in r) throw new Error(r.error);
    return r;
  };
  const printHere = async () => {
    setLocal({ busy: true, msg: null, error: null });
    try {
      const { zpl, total: n } = await getZpl();
      await printViaBrowserPrint(zpl);
      setLocal({ busy: false, msg: `Sent ${n} labels to this computer's Zebra.`, error: null });
    } catch (e) {
      setLocal({ busy: false, msg: null, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const download = async () => {
    try {
      const { zpl } = await getZpl();
      const url = URL.createObjectURL(new Blob([zpl], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `fba-labels-package-${runNo}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setLocal({ busy: false, msg: null, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <style>{PAGE_CSS}</style>
      <main className="mx-auto max-w-4xl px-5 py-10 print:m-0 print:max-w-none print:p-0">
        <header className="mb-6 print:hidden">
          <Link href="/admin/packaging" className="text-sm text-zinc-500 hover:text-lime-400">
            ← Packages
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Package #{runNo} labels · packed {packedOn}
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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={printHere}
              disabled={total === 0 || local.busy}
              className="rounded bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40"
            >
              {local.busy ? "Sending…" : `Print ${total} on this computer's Zebra`}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={total === 0}
              className="rounded border border-zinc-700 px-4 py-1.5 text-sm hover:border-lime-400 disabled:opacity-40"
            >
              Download ZPL
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={total === 0}
              className="rounded border border-zinc-700 px-4 py-1.5 text-sm hover:border-lime-400 disabled:opacity-40"
            >
              Browser print (DYMO)
            </button>
            <form action={sendToZebra}>
              <input type="hidden" name="runNo" value={runNo} />
              {items.map((i) => (
                <input key={i.key} type="hidden" name={`count_${i.key}`} value={counts[i.key] ?? 0} />
              ))}
              <button
                type="submit"
                disabled={total === 0 || sending}
                className="rounded border border-zinc-800 px-4 py-1.5 text-sm text-zinc-400 hover:border-lime-400 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Office Zebra (network)"}
              </button>
            </form>
          </div>
          {local.msg || zebra.printed ? (
            <p className="mt-2 text-sm text-lime-300">{local.msg ?? `Sent ${zebra.printed} labels to the office Zebra.`}</p>
          ) : null}
          {local.error || zebra.error ? (
            <p className="mt-2 text-sm text-red-300">{local.error ?? zebra.error}</p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Zebra: load 2¼×1¼ labels and calibrate after a roll change. Don&apos;t click twice: a slow
            printer can still be printing the first job.
          </p>
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

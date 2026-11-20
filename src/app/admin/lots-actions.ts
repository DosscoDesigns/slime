"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/admin-session";
import { createBulkRun, createPackRun, listPackLots } from "@/lib/traceability";
import { printZpl } from "@/lib/print";
import { fbaLabelZpl } from "@/lib/fba-label-zpl";
import { labelTitle } from "@/lib/fba-label";
import { createInboundPlan } from "@/lib/amazon-inbound";
import { amazonConfigured } from "@/lib/amazon-inventory";
import { logError, errorContext } from "@/lib/logger";
import { AllocationError, yymmdd } from "@/lib/lots";
import { AMAZON_LISTINGS, PACK_VARIANTS, type Plan } from "@/lib/packaging";
import { COLOR_ORDER } from "@/lib/manufacturing";
import type { SlimeColor } from "@/lib/products";

// Server actions are public HTTP endpoints; the page's own guard does not
// cover them, so each one checks the session itself.
async function guard(): Promise<void> {
  if (!(await isSignedIn())) redirect("/admin/login");
}

const isoDate = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Pick a date.");
  return s;
};
const posInt = (v: FormDataEntryValue | null, what: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${what} must be a whole number above 0.`);
  return n;
};

// Always the same three people; kept on the record so it can become a field later.
const PACKED_BY = "The Slime Guys";

export interface ActionState {
  error: string | null;
}

export async function logBulkRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  let batchKey: string;
  try {
    const colors = COLOR_ORDER.filter((c) => form.has(`pouches_${c}`));
    const lots = colors.map((color: SlimeColor) => ({
      color,
      pouches: Math.max(0, Math.floor(Number(form.get(`pouches_${color}`)) || 0)),
    }));
    if (lots.length === 0) throw new Error("No colors to log.");
    const baseLbPerColor = Number(form.get("baseLbPerColor"));
    const madeOn = isoDate(form.get("madeOn"));
    const runNo = posInt(form.get("runNo"), "Run #");
    await createBulkRun({
      madeOn,
      runNo,
      base: form.get("base") === "malto" ? "malto" : "poly",
      baseLbPerColor: baseLbPerColor > 0 ? baseLbPerColor : 0.01,
      lots,
      supplierLots: String(form.get("supplierLots") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    });
    batchKey = `${yymmdd(madeOn)}-${String(runNo).padStart(2, "0")}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: /duplicate key/.test(msg) ? "That run # is already logged for this date and color." : msg,
    };
  }
  revalidatePath("/admin/batches");
  revalidatePath("/admin/packaging");
  // Straight on to packing this batch — the usual next step.
  redirect(`/admin/packaging/new?batch=${encodeURIComponent(batchKey)}`);
}

export async function recordPackRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  let runNo: number;
  try {
    const raw = JSON.parse(String(form.get("plan") ?? "{}")) as Record<string, unknown>;
    const plan: Plan = {};
    for (const v of PACK_VARIANTS) {
      const n = Number(raw[v.id] ?? 0);
      if (Number.isInteger(n) && n > 0) plan[v.id] = n;
    }
    const missing = PACK_VARIANTS.filter((v) => plan[v.id] && !v.fnsku);
    if (missing.length) {
      throw new Error(`No FNSKU yet for ${missing.map((v) => v.name).join(", ")}.`);
    }
    const lotIds = (JSON.parse(String(form.get("lots") ?? "[]")) as unknown[])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    runNo = await createPackRun({
      packedOn: isoDate(form.get("packedOn")),
      plan,
      lotIds,
      packedBy: PACKED_BY,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof AllocationError) return { error: msg };
    return {
      error: msg,
    };
  }
  revalidatePath("/admin/batches");
  revalidatePath("/admin/packaging");
  redirect(`/admin/labels/${runNo}`);
}

export interface PrintState {
  error: string | null;
  printed: number | null;
}

/** ZPL for a packing run's labels. Counts come from the form; content from the database. */
async function buildLabelZpl(form: FormData): Promise<{ zpl: string; total: number }> {
  const runNo = posInt(form.get("runNo"), "Packing run");
  const rows = await listPackLots(runNo);
  const jobs: string[] = [];
  let total = 0;
  for (const r of rows) {
    const n = Math.floor(Number(form.get(`count_${r.id}`)) || 0);
    if (n <= 0 || !r.fnsku) continue;
    const v = PACK_VARIANTS.find((x) => x.id === r.variantId);
    jobs.push(
      fbaLabelZpl({
        fnsku: r.fnsku,
        title: labelTitle(v?.title ?? r.variantId),
        lotCode: r.lotCode,
        copies: n,
      })
    );
    total += n;
  }
  return { zpl: jobs.join("\n"), total };
}

export interface PrintState {
  error: string | null;
  printed: number | null;
}

/** Office Zebra (GX420d, the print worker's "4x2" printer, on DD's network). */
export async function printFbaLabels(_prev: PrintState, form: FormData): Promise<PrintState> {
  await guard();
  try {
    const { zpl, total } = await buildLabelZpl(form);
    if (total === 0) return { error: "Nothing to print.", printed: null };
    await printZpl({ zpl, printer: "4x2" });
    return { error: null, printed: total };
  } catch (e) {
    logError("admin.fba_label_print_failed", errorContext(e));
    return { error: e instanceof Error ? e.message : String(e), printed: null };
  }
}

/** The ZPL itself, for a Zebra on the computer in front of you (Browser Print or a download). */
export async function fbaLabelZplFor(form: FormData): Promise<{ zpl: string; total: number } | { error: string }> {
  await guard();
  try {
    return await buildLabelZpl(form);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export interface SendState {
  error: string | null;
  url: string | null;
}

/**
 * Create the Send to Amazon draft for a packing run. Only the plan: placement
 * and shipping, which cost money, are finished by a person in Seller Central.
 */
export async function sendToAmazon(_prev: SendState, form: FormData): Promise<SendState> {
  await guard();
  try {
    if (!amazonConfigured()) throw new Error("The Amazon connection isn't set up here.");
    // A local test database holds made-up packages; never send those to the real account.
    if (/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.SLIME_DATABASE_URL ?? "")) {
      throw new Error("Send to Amazon is off on the test database. It works on the live site.");
    }
    const runNo = posInt(form.get("runNo"), "Packing run");
    const rows = await listPackLots(runNo);
    if (rows.length === 0) throw new Error("No such packing run.");
    const qty = new Map<string, number>();
    for (const r of rows) {
      const sku = AMAZON_LISTINGS[r.variantId]?.[0]?.sellerSku;
      if (!sku || !r.fnsku) continue;
      qty.set(sku, (qty.get(sku) ?? 0) + r.kits);
    }
    const plan = await createInboundPlan({
      runNo,
      packedOn: rows[0].packedOn,
      items: [...qty].map(([msku, quantity]) => ({ msku, quantity })),
    });
    revalidatePath("/admin/packaging");
    return { error: null, url: plan.url };
  } catch (e) {
    logError("admin.send_to_amazon_failed", errorContext(e));
    return { error: e instanceof Error ? e.message : String(e), url: null };
  }
}

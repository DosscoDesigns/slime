"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSignedIn } from "@/lib/admin-session";
import { createBulkRun, createPackRun } from "@/lib/traceability";
import { AllocationError } from "@/lib/lots";
import { PACK_VARIANTS, type Plan } from "@/lib/packaging";
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

export interface ActionState {
  error: string | null;
}

export async function logBulkRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  let codes: string[];
  try {
    const colors = COLOR_ORDER.filter((c) => form.has(`pouches_${c}`));
    const lots = colors.map((color: SlimeColor) => ({
      color,
      pouches: Math.max(0, Math.floor(Number(form.get(`pouches_${color}`)) || 0)),
    }));
    if (lots.length === 0) throw new Error("No colors to log.");
    const baseLbPerColor = Number(form.get("baseLbPerColor"));
    codes = await createBulkRun({
      madeOn: isoDate(form.get("madeOn")),
      runNo: posInt(form.get("runNo"), "Run #"),
      base: form.get("base") === "malto" ? "malto" : "poly",
      baseLbPerColor: baseLbPerColor > 0 ? baseLbPerColor : 0.01,
      lots,
      supplierLots: String(form.get("supplierLots") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: /duplicate key/.test(msg) ? "That run # is already logged for this date and color." : msg,
    };
  }
  revalidatePath("/admin/lots");
  redirect(`/admin/lots?logged=${encodeURIComponent(codes.join(","))}`);
}

export async function recordPackRun(_prev: ActionState, form: FormData): Promise<ActionState> {
  await guard();
  let lotCode: string;
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
    lotCode = await createPackRun({
      packedOn: isoDate(form.get("packedOn")),
      runNo: posInt(form.get("runNo"), "Run #"),
      plan,
      packedBy: String(form.get("packedBy") ?? "").trim(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof AllocationError) return { error: msg };
    return {
      error: /duplicate key/.test(msg) ? "That packing run # is already used for this date." : msg,
    };
  }
  revalidatePath("/admin/lots");
  revalidatePath("/admin/packaging");
  redirect(`/admin/labels/${encodeURIComponent(lotCode)}`);
}

/**
 * FBA "Send to Amazon" via the Fulfillment Inbound API (v2024-03-20).
 * SERVER-ONLY.
 *
 * We only ever create the inbound PLAN — a draft in Seller Central's Send to
 * Amazon workflow with our SKUs and quantities. Every step that commits money
 * (confirming placement, buying the partnered-carrier shipping) is left to a
 * person in Seller Central, where the cost is shown first.
 *
 * Plans are tied back to a packing run by name ("Slime pack #12 …"), so the
 * link needs no column in our database: the status comes from Amazon.
 */
import { accessToken, SP_API, MARKETPLACE_US } from "@/lib/amazon-inventory";

const BASE = `${SP_API}/inbound/fba/2024-03-20`;

export class InboundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboundError";
  }
}

async function sp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-amz-access-token": await accessToken(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { errors?: { message?: string; details?: string }[] };
      if (j.errors?.length) detail = j.errors.map((e) => [e.message, e.details].filter(Boolean).join(": ")).join("; ");
    } catch {}
    throw new InboundError(`Amazon ${res.status}: ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** The name we give a plan, and how we recognise ours among the account's plans. */
export const planName = (runNo: number, packedOn: string) => `Slime pack #${runNo} (${packedOn})`;
const NAME_RE = /^Slime pack #(\d+)\b/;

export const sendToAmazonUrl = (inboundPlanId: string) =>
  `https://sellercentral.amazon.com/fba/sendtoamazon?wf=${encodeURIComponent(inboundPlanId)}`;

interface Address {
  name?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
  phoneNumber?: string;
  email?: string;
}

interface PlanSummary {
  inboundPlanId: string;
  name?: string;
  status: string;
  createdAt: string;
  sourceAddress?: Address;
}

export interface InboundStatus {
  inboundPlanId: string;
  status: string; // ACTIVE | VOIDED | SHIPPED
  createdAt: string;
  shipments: { shipmentId: string; status: string }[];
  url: string;
}

async function listPlans(pages = 3): Promise<PlanSummary[]> {
  const out: PlanSummary[] = [];
  let next: string | undefined;
  for (let i = 0; i < pages; i++) {
    const q = new URLSearchParams({ pageSize: "30", sortBy: "CREATION_TIME", sortOrder: "DESC" });
    if (next) q.set("paginationToken", next);
    const body = await sp<{ inboundPlans?: PlanSummary[]; pagination?: { nextToken?: string } }>(
      `/inboundPlans?${q}`
    );
    out.push(...(body.inboundPlans ?? []));
    next = body.pagination?.nextToken;
    if (!next) break;
  }
  return out;
}

let cache: { at: number; data: Record<number, InboundStatus> } | null = null;
const CACHE_MS = 2 * 60_000;

/** Our plans keyed by packing run number, newest plan per run, with shipment statuses. */
export async function inboundByPackRun(fresh = false): Promise<Record<number, InboundStatus>> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data: Record<number, InboundStatus> = {};
  const ours = (await listPlans()).filter((p) => NAME_RE.test(p.name ?? "") && p.status !== "VOIDED");
  for (const p of ours.slice(0, 15)) {
    const run = Number(NAME_RE.exec(p.name!)![1]);
    if (data[run]) continue; // newest first; keep the newest
    const full = await sp<{ shipments?: { shipmentId: string; status: string }[] }>(
      `/inboundPlans/${encodeURIComponent(p.inboundPlanId)}`
    );
    data[run] = {
      inboundPlanId: p.inboundPlanId,
      status: p.status,
      createdAt: p.createdAt,
      shipments: (full.shipments ?? []).map((s) => ({ shipmentId: s.shipmentId, status: s.status })),
      url: sendToAmazonUrl(p.inboundPlanId),
    };
  }
  cache = { at: Date.now(), data };
  return data;
}

type Owner = "SELLER" | "AMAZON" | "NONE";

/** Owner corrections named in an Amazon createInboundPlan error, if any. */
export function ownerFixes(message: string): { msku: string; field: "prepOwner" | "labelOwner"; value: Owner }[] {
  return [...message.matchAll(/(\S+) does not require (prepOwner|labelOwner)[^[]*Accepted values: \[(\w+)/g)]
    .filter(([, , , v]) => v === "NONE" || v === "SELLER" || v === "AMAZON")
    .map(([, msku, field, value]) => ({
      msku,
      field: field as "prepOwner" | "labelOwner",
      value: value as Owner,
    }));
}
const owner = (constraint: string | undefined): Owner =>
  constraint === "AMAZON_ONLY" ? "AMAZON" : constraint === "NONE_ONLY" ? "NONE" : "SELLER";

/**
 * Ship-from address: FBA_SHIP_FROM (JSON) if set, else the address on the
 * account's most recent plan, which is wherever the last shipment left from.
 */
async function shipFrom(): Promise<Address> {
  if (process.env.FBA_SHIP_FROM) return JSON.parse(process.env.FBA_SHIP_FROM) as Address;
  const recent = (await listPlans(1)).find((p) => p.sourceAddress?.addressLine1);
  if (!recent?.sourceAddress) {
    throw new InboundError("No ship-from address: set FBA_SHIP_FROM or create one plan in Seller Central first.");
  }
  const a = recent.sourceAddress;
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v != null && v !== "")) as unknown as Address;
}

/**
 * Create the draft plan for a packing run. Refuses if the run already has a
 * live plan, so a double click can't make two.
 */
export async function createInboundPlan(input: {
  runNo: number;
  packedOn: string;
  items: { msku: string; quantity: number }[];
}): Promise<InboundStatus> {
  if (input.items.length === 0) throw new InboundError("Nothing in this packing run can go to Amazon.");
  const existing = (await inboundByPackRun(true))[input.runNo];
  if (existing) return existing;

  // Asked for several SKUs at once, prepDetails answers for the first only,
  // so ask one at a time (it's a handful, well inside the 2 req/s limit).
  const owners = new Map<string, { labelOwner: Owner; prepOwner: Owner }>();
  for (const i of input.items) {
    const q = new URLSearchParams({ marketplaceId: MARKETPLACE_US, mskus: i.msku });
    const prep = await sp<{
      mskuPrepDetails?: { msku: string; labelOwnerConstraint?: string; prepOwnerConstraint?: string }[];
    }>(`/items/prepDetails?${q}`);
    const d = prep.mskuPrepDetails?.find((x) => x.msku === i.msku);
    owners.set(i.msku, {
      labelOwner: owner(d?.labelOwnerConstraint),
      prepOwner: owner(d?.prepOwnerConstraint),
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  const name = planName(input.runNo, input.packedOn);
  const sourceAddress = await shipFrom();
  const body = () =>
    JSON.stringify({
      name,
      destinationMarketplaces: [MARKETPLACE_US],
      sourceAddress,
      items: input.items.map((i) => ({ msku: i.msku, quantity: i.quantity, ...owners.get(i.msku)! })),
    });

  // If Amazon still disagrees about an owner, its error names the accepted
  // value ("X does not require prepOwner but SELLER was assigned. Accepted
  // values: [NONE]"); apply it and try again, a couple of times at most.
  let created: { inboundPlanId: string; operationId: string } | null = null;
  for (let attempt = 0; !created; attempt++) {
    try {
      created = await sp<{ inboundPlanId: string; operationId: string }>("/inboundPlans", {
        method: "POST",
        body: body(),
      });
    } catch (e) {
      const fixes = ownerFixes(e instanceof Error ? e.message : String(e));
      if (attempt >= 2 || fixes.length === 0) throw e;
      for (const f of fixes) {
        const o = owners.get(f.msku);
        if (o) o[f.field] = f.value;
      }
    }
  }

  // Creation is asynchronous; wait briefly so a rejection shows up here, not later.
  for (let i = 0; i < 8; i++) {
    const op = await sp<{ operationStatus: string; operationProblems?: { message: string }[] }>(
      `/operations/${encodeURIComponent(created.operationId)}`
    );
    if (op.operationStatus === "SUCCESS") break;
    if (op.operationStatus === "FAILED") {
      throw new InboundError(
        `Amazon rejected the plan: ${(op.operationProblems ?? []).map((p) => p.message).join("; ") || "no reason given"}`
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  cache = null;
  return {
    inboundPlanId: created.inboundPlanId,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    shipments: [],
    url: sendToAmazonUrl(created.inboundPlanId),
  };
}

/**
 * Cancel the plan for a packing run. Only plans named for that run — never
 * one a person created by hand in Seller Central.
 */
export async function cancelInboundPlan(runNo: number): Promise<void> {
  const plan = (await inboundByPackRun(true))[runNo];
  if (!plan) throw new InboundError("No Amazon plan for this package.");
  await sp(`/inboundPlans/${encodeURIComponent(plan.inboundPlanId)}/cancellation`, { method: "PUT" });
  cache = null;
}

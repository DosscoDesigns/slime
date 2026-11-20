/**
 * FBA stock per FNSKU from the Selling Partner API. SERVER-ONLY.
 *
 * Read-only: getInventorySummaries, filtered to our own seller SKUs so it
 * never pages through the account's ~2,700 legacy book listings. The LWA
 * credentials (op://DEV/slime.amazon.prod) have no NEXT_PUBLIC_ prefix and
 * must never reach the browser.
 */
import { AMAZON_LISTINGS } from "@/lib/packaging";

const MARKETPLACE_US = "ATVPDKIKX0DER";
const SP_API = "https://sellingpartnerapi-na.amazon.com";

export interface FbaStock {
  sellerSku: string;
  fnsku: string;
  available: number;
  inbound: number;
  reserved: number;
  unfulfillable: number;
  researching: number;
  total: number;
}

export class AmazonConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmazonConfigError";
  }
}

export function amazonConfigured(): boolean {
  return Boolean(
    process.env.AMAZON_SP_CLIENT_ID &&
      process.env.AMAZON_SP_CLIENT_SECRET &&
      process.env.AMAZON_SP_REFRESH_TOKEN
  );
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (typeof window !== "undefined") {
    throw new AmazonConfigError("amazon-inventory.ts was imported into browser code");
  }
  if (!amazonConfigured()) throw new AmazonConfigError("Amazon SP-API credentials are not set");
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_SP_CLIENT_ID!,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Amazon login failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

interface Summary {
  sellerSku: string;
  fnSku: string;
  totalQuantity?: number;
  inventoryDetails?: {
    fulfillableQuantity?: number;
    inboundWorkingQuantity?: number;
    inboundShippedQuantity?: number;
    inboundReceivingQuantity?: number;
    reservedQuantity?: { totalReservedQuantity?: number };
    unfulfillableQuantity?: { totalUnfulfillableQuantity?: number };
    researchingQuantity?: { totalResearchingQuantity?: number };
  };
}

export function toStock(s: Summary): FbaStock {
  const d = s.inventoryDetails ?? {};
  return {
    sellerSku: s.sellerSku,
    fnsku: s.fnSku,
    available: d.fulfillableQuantity ?? 0,
    inbound:
      (d.inboundWorkingQuantity ?? 0) +
      (d.inboundShippedQuantity ?? 0) +
      (d.inboundReceivingQuantity ?? 0),
    reserved: d.reservedQuantity?.totalReservedQuantity ?? 0,
    unfulfillable: d.unfulfillableQuantity?.totalUnfulfillableQuantity ?? 0,
    researching: d.researchingQuantity?.totalResearchingQuantity ?? 0,
    total: s.totalQuantity ?? 0,
  };
}

let cache: { at: number; data: Record<string, FbaStock> } | null = null;
const CACHE_MS = 2 * 60_000;

/** Stock keyed by FNSKU. Cached for two minutes; the endpoint is rate-limited. */
export async function fbaStockByFnsku(): Promise<Record<string, FbaStock>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const skus = Object.values(AMAZON_LISTINGS).flatMap((l) => l.map((x) => x.sellerSku));
  const q = new URLSearchParams({
    granularityType: "Marketplace",
    granularityId: MARKETPLACE_US,
    marketplaceIds: MARKETPLACE_US,
    details: "true",
    sellerSkus: skus.join(","),
  });
  const res = await fetch(`${SP_API}/fba/inventory/v1/summaries?${q}`, {
    headers: { "x-amz-access-token": await accessToken() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Amazon inventory request failed (${res.status})`);
  const body = (await res.json()) as { payload: { inventorySummaries: Summary[] } };
  const data: Record<string, FbaStock> = {};
  for (const s of body.payload.inventorySummaries) data[s.fnSku] = toStock(s);
  cache = { at: Date.now(), data };
  return data;
}

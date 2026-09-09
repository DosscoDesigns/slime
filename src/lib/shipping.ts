/**
 * Shippo client — buys USPS labels and returns ZPL for the Zebra.
 *
 * SERVER-ONLY. SHIPPO_API_KEY buys real postage with real money; it must never
 * reach the browser, so it carries no NEXT_PUBLIC_ prefix. See src/lib/print.ts
 * for the same rule and why it matters here.
 *
 * Why Shippo and not Pirate Ship: Pirate Ship has no public API at all. Shippo
 * sits on the same USPS Commercial Plus tier, costs $0.05/label, and returns
 * native ZPL — so a bought label goes straight to the printer with no PDF
 * rasterizing step.
 *
 * Everything below was verified against the live API with a test key rather
 * than read off the docs, which is how the two non-obvious constraints were
 * found: USPS rejects a from-address with no email AND phone, and `label_url`
 * is a URL to fetch, not inline ZPL.
 */

const SHIPPO_BASE = "https://api.goshippo.com";

/** Zebra 4x6 at 203dpi. Shippo's token for that is ZPLII, not "ZPL". */
const LABEL_FILE_TYPE = "ZPLII";

export class ShippoError extends Error {
  // Declared and assigned rather than a constructor parameter property:
  // parameter properties are TS-only syntax that Node's strip-only type
  // stripping cannot run, and these modules are loaded directly by node in
  // the fulfilment scripts.
  readonly messages: ShippoMessage[];

  constructor(message: string, messages: ShippoMessage[] = []) {
    super(message);
    this.name = "ShippoError";
    this.messages = messages;
  }
}

interface ShippoMessage {
  source?: string;
  code?: string;
  text?: string;
}

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  /** USPS rejects a purchase whose SENDER lacks these two. Not optional there. */
  email?: string;
  phone?: string;
}

export interface Parcel {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;
}

export interface Rate {
  id: string;
  provider: string;
  service: string;
  serviceToken: string;
  amountCents: number;
  estimatedDays: number | null;
}

export interface PurchasedLabel {
  transactionId: string;
  trackingNumber: string;
  trackingUrl: string;
  /** A signed, EXPIRING URL — fetch the ZPL promptly, don't store the link. */
  labelUrl: string;
  amountCents: number;
  provider: string;
  service: string;
}

/**
 * USPS charges by dimensional weight once a parcel passes one cubic foot, and
 * the step is brutal rather than gradual. Measured FL->PA with a live test key:
 * a 12x10x8 box (0.56 cu ft) at 3 lb is $6.99, while a 16x12x10 box (1.11 cu ft)
 * is $16.87 at the SAME weight — 2.4x for air.
 *
 * This is the rule that killed buckets as a shipped add-on. Keep parcels under
 * a cubic foot; it matters far more than mailer-vs-box.
 */
export const DIM_WEIGHT_THRESHOLD_CU_FT = 1;

export function parcelCubicFeet(p: Parcel): number {
  return (p.lengthIn * p.widthIn * p.heightIn) / 1728;
}

/** True when this parcel will be billed on volume rather than actual weight. */
export function exceedsDimWeightThreshold(p: Parcel): boolean {
  return parcelCubicFeet(p) > DIM_WEIGHT_THRESHOLD_CU_FT;
}

function assertServerSide(): void {
  if (typeof window !== "undefined") {
    throw new ShippoError(
      "shipping.ts was imported into browser code — SHIPPO_API_KEY buys real postage and must never ship to the client"
    );
  }
}

export function assertShippoConfigured(): void {
  if (!process.env.SHIPPO_API_KEY) {
    throw new ShippoError("Shippo is not configured (need SHIPPO_API_KEY)");
  }
}

/** True when the configured key is a test key, which buys no real postage. */
export function isTestMode(): boolean {
  return (process.env.SHIPPO_API_KEY ?? "").startsWith("shippo_test_");
}

/**
 * Buying a label is worth waiting for — the alternative to a slow success is
 * an orphaned label. Reads are not: they run on request paths with a platform
 * function budget, and a hung read must fail fast enough that our own catch
 * still runs. Hence two budgets rather than one.
 */
export const WRITE_TIMEOUT_MS = 30_000;
export const READ_TIMEOUT_MS = 4_000;

async function shippoRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs: number = WRITE_TIMEOUT_MS
): Promise<T> {
  assertServerSide();
  assertShippoConfigured();

  const res = await fetch(`${SHIPPO_BASE}${path}`, {
    method,
    headers: {
      // Shippo's scheme, not Bearer.
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY!}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new ShippoError(
      `Shippo ${res.status} on ${path}: ${(await res.text()).slice(0, 400)}`
    );
  }
  return (await res.json()) as T;
}

async function shippo<T>(path: string, body: unknown): Promise<T> {
  return shippoRequest<T>("POST", path, body);
}

/** GET on a read path — short timeout, no body. */
export async function shippoGet<T>(path: string): Promise<T> {
  return shippoRequest<T>("GET", path, undefined, READ_TIMEOUT_MS);
}

/** POST on a read path (registration) — short timeout. */
export async function shippoPostFast<T>(path: string, body: unknown): Promise<T> {
  return shippoRequest<T>("POST", path, body, READ_TIMEOUT_MS);
}

/**
 * The address labels are sent FROM, read from env.
 *
 * email and phone are required, not decorative: USPS refuses the purchase with
 * "Seller info missing email or phone" and Shippo surfaces it only at the
 * transaction step — i.e. after rates have already come back looking healthy.
 * Failing here instead means the operator learns at configuration time.
 */
export function shipFromAddress(): Address {
  const need = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new ShippoError(`${k} is not set — cannot build the ship-from address`);
    return v;
  };
  return {
    name: need("SHIP_FROM_NAME"),
    company: process.env.SHIP_FROM_COMPANY,
    street1: need("SHIP_FROM_STREET1"),
    street2: process.env.SHIP_FROM_STREET2,
    city: need("SHIP_FROM_CITY"),
    state: need("SHIP_FROM_STATE"),
    zip: need("SHIP_FROM_ZIP"),
    country: process.env.SHIP_FROM_COUNTRY ?? "US",
    email: need("SHIP_FROM_EMAIL"),
    phone: need("SHIP_FROM_PHONE"),
  };
}

function toShippoAddress(a: Address): Record<string, string | undefined> {
  return {
    name: a.name,
    company: a.company,
    street1: a.street1,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country,
    email: a.email,
    phone: a.phone,
  };
}

/** Shippo returns money as a decimal STRING ("6.99"); never float-multiply it. */
function toCents(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}

interface ShippoShipmentResponse {
  object_id: string;
  status: string;
  messages?: ShippoMessage[];
  rates?: Array<{
    object_id: string;
    provider: string;
    amount: string;
    estimated_days: number | null;
    servicelevel: { name: string; token: string };
  }>;
}

export interface RateQuote {
  shipmentId: string;
  rates: Rate[];
  /** Carrier-level complaints. Mostly noise about carriers we don't use. */
  messages: ShippoMessage[];
}

/**
 * Quote a shipment. Rates come back cheapest-first.
 *
 * `messages` is almost always non-empty even on success — Shippo reports every
 * master carrier account that declined, most of which are European carriers we
 * will never use. Do not treat a non-empty messages array as failure; treat an
 * empty `rates` array as failure.
 */
export async function getRates(to: Address, parcel: Parcel): Promise<RateQuote> {
  const res = await shippo<ShippoShipmentResponse>("/shipments/", {
    address_from: toShippoAddress(shipFromAddress()),
    address_to: toShippoAddress(to),
    parcels: [
      {
        length: String(parcel.lengthIn),
        width: String(parcel.widthIn),
        height: String(parcel.heightIn),
        distance_unit: "in",
        weight: String(parcel.weightLb),
        mass_unit: "lb",
      },
    ],
    async: false,
  });

  const rates: Rate[] = (res.rates ?? [])
    .map((r) => ({
      id: r.object_id,
      provider: r.provider,
      service: r.servicelevel.name,
      serviceToken: r.servicelevel.token,
      amountCents: toCents(r.amount),
      estimatedDays: r.estimated_days,
    }))
    .sort((a, b) => a.amountCents - b.amountCents);

  if (rates.length === 0) {
    throw new ShippoError(
      "Shippo returned no rates for this shipment — check the address and parcel",
      res.messages ?? []
    );
  }

  return { shipmentId: res.object_id, rates, messages: res.messages ?? [] };
}

interface ShippoTransactionResponse {
  object_id: string;
  status: string;
  messages?: ShippoMessage[];
  tracking_number?: string;
  tracking_url_provider?: string;
  label_url?: string;
  rate?: { amount: string; provider: string; servicelevel?: { name: string } };
}

/**
 * Buy the label for a rate.
 *
 * With a live key this SPENDS MONEY and is not reversible without a refund
 * request, so callers must be certain of the rate before calling.
 */
export async function buyLabel(
  rateId: string,
  /**
   * Stamped onto the Shippo Transaction and echoed on the Track object, so an
   * inbound tracking webhook carries its own order reference and needs no
   * lookup. Shippo caps this at 100 characters; a PaymentIntent id is ~27.
   */
  orderRef?: string
): Promise<PurchasedLabel> {
  const res = await shippo<ShippoTransactionResponse>("/transactions/", {
    rate: rateId,
    label_file_type: LABEL_FILE_TYPE,
    async: false,
    ...(orderRef ? { metadata: orderRef.slice(0, 100) } : {}),
  });

  if (res.status !== "SUCCESS" || !res.label_url || !res.tracking_number) {
    const detail = (res.messages ?? []).map((m) => m.text).filter(Boolean).join("; ");
    throw new ShippoError(
      `Shippo would not issue the label${detail ? `: ${detail}` : ` (status ${res.status})`}`,
      res.messages ?? []
    );
  }

  return {
    transactionId: res.object_id,
    trackingNumber: res.tracking_number,
    trackingUrl: res.tracking_url_provider ?? "",
    labelUrl: res.label_url,
    amountCents: res.rate ? toCents(res.rate.amount) : 0,
    provider: res.rate?.provider ?? "USPS",
    service: res.rate?.servicelevel?.name ?? "",
  };
}

/**
 * Fetch the actual ZPL. `label_url` is a signed, expiring link rather than
 * inline label data, so this is a required second hop — and a reason to print
 * (or persist) promptly rather than storing the URL for later.
 */
export async function fetchLabelZpl(labelUrl: string): Promise<string> {
  assertServerSide();

  const res = await fetch(labelUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new ShippoError(`could not download the label ZPL: ${res.status}`);
  }
  const zpl = await res.text();

  // A signed URL that has expired returns an XML error page with HTTP 200 in
  // some S3 configurations, so check the payload actually looks like ZPL
  // rather than trusting the status code.
  if (!zpl.trimStart().startsWith("^XA")) {
    throw new ShippoError(
      `label download did not return ZPL (got ${zpl.slice(0, 80)}…) — the signed URL may have expired`
    );
  }
  return zpl;
}

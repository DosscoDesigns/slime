/**
 * Batch traceability store. SERVER-ONLY.
 *
 * Talks to the `slime` schema in DD's Supabase over Postgres as the
 * slime_app role (SLIME_DATABASE_URL, a Supavisor transaction-mode URI, hence
 * prepare:false). The schema is deliberately not exposed through the Supabase
 * Data API — see db/migrations/0001_slime_traceability.sql.
 */
import postgres from "postgres";
import type { SlimeColor } from "@/lib/products";
import { PACK_COLORS, PACK_VARIANTS, type Counts, type Plan } from "@/lib/packaging";
import { allocate, bulkLotCode, packLotCode, COLOR_CODE, type Balance } from "@/lib/lots";

export class TraceabilityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceabilityConfigError";
  }
}

let client: postgres.Sql | null = null;

function sql(): postgres.Sql {
  if (typeof window !== "undefined") {
    throw new TraceabilityConfigError("traceability.ts was imported into browser code");
  }
  const url = process.env.SLIME_DATABASE_URL;
  if (!url) throw new TraceabilityConfigError("SLIME_DATABASE_URL is not set");
  if (!client) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    client = postgres(url, {
      prepare: false,
      max: 3,
      ssl: local ? false : "require",
      idle_timeout: 20,
      types: { bigint: postgres.BigInt },
    });
  }
  return client;
}

export function traceabilityConfigured(): boolean {
  return Boolean(process.env.SLIME_DATABASE_URL);
}

const iso = (d: Date | string) =>
  typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);

export interface BulkLotRow {
  id: number;
  lotCode: string;
  madeOn: string;
  color: SlimeColor;
  runNo: number;
  pouchesFilled: number;
  pouchesUsed: number;
  pouchesRemaining: number;
  supplierLots: string | null;
  notes: string | null;
}

export async function listBulkLots(): Promise<BulkLotRow[]> {
  const rows = await sql()`
    select id, lot_code, made_on, color, run_no, pouches_filled, pouches_used,
           pouches_remaining, supplier_lots, notes
    from slime.bulk_lot_balances
    order by made_on desc, run_no desc, color`;
  return rows.map((r) => ({
    id: Number(r.id),
    lotCode: r.lot_code,
    madeOn: iso(r.made_on),
    color: r.color,
    runNo: r.run_no,
    pouchesFilled: r.pouches_filled,
    pouchesUsed: r.pouches_used,
    pouchesRemaining: r.pouches_remaining,
    supplierLots: r.supplier_lots,
    notes: r.notes,
  }));
}

export async function onHandByColor(): Promise<Counts> {
  const rows = await sql()`
    select color, coalesce(sum(pouches_remaining), 0)::int as n
    from slime.bulk_lot_balances group by color`;
  const counts: Counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const r of rows) counts[r.color as SlimeColor] = r.n;
  return counts;
}

export async function nextBulkRunNo(): Promise<number> {
  const [r] = await sql()`select coalesce(max(run_no), 0) + 1 as n from slime.bulk_lots`;
  return r.n;
}

export async function nextPackRunNo(): Promise<number> {
  const [r] = await sql()`select coalesce(max(run_no), 0) + 1 as n from slime.pack_lots`;
  return r.n;
}

export interface NewBulkRun {
  madeOn: string;
  runNo: number;
  /** null for pouches counted on hand (carryover) rather than mixed here. */
  base: "poly" | "malto" | null;
  baseLbPerColor: number | null;
  lots: { color: SlimeColor; pouches: number }[];
  supplierLots?: string;
  notes?: string;
}

/** One bulk lot per color, sharing the run number. Returns the lot codes. */
export async function createBulkRun(run: NewBulkRun): Promise<string[]> {
  const rows = run.lots.map((l) => ({
    lot_code: bulkLotCode(run.madeOn, l.color, run.runNo),
    made_on: run.madeOn,
    color: l.color,
    color_code: COLOR_CODE[l.color],
    run_no: run.runNo,
    base_ingredient: run.base,
    base_lb: run.base && run.baseLbPerColor ? run.baseLbPerColor.toFixed(2) : null,
    pouches_filled: l.pouches,
    supplier_lots: run.supplierLots || null,
    notes: run.notes || null,
  }));
  await sql()`insert into slime.bulk_lots ${sql()(rows)}`;
  return rows.map((r) => r.lot_code);
}

/**
 * Record a packing run: one pack lot per FNSKU, pouches drawn oldest-first.
 * The balance read and the inserts share a transaction with the bulk lots
 * locked, so two people packing at once can't both spend the same pouches.
 */
export async function createPackRun(input: {
  packedOn: string;
  runNo: number;
  plan: Plan;
  packedBy?: string;
}): Promise<string> {
  const lotCode = packLotCode(input.packedOn, input.runNo);
  await sql().begin(async (tx) => {
    await tx`select id from slime.bulk_lots for update`;
    const bal = await tx`
      select id, color, made_on, pouches_remaining from slime.bulk_lot_balances`;
    const balances: Balance[] = bal.map((b) => ({
      id: Number(b.id),
      color: b.color,
      madeOn: iso(b.made_on),
      remaining: b.pouches_remaining,
    }));
    for (const a of allocate(balances, input.plan)) {
      const v = PACK_VARIANTS.find((x) => x.id === a.variantId)!;
      const [lot] = await tx`
        insert into slime.pack_lots (lot_code, packed_on, run_no, variant_id, fnsku, kits, packed_by)
        values (${lotCode}, ${input.packedOn}, ${input.runNo}, ${v.id}, ${v.fnsku},
                ${a.kits}, ${input.packedBy || null})
        returning id`;
      const comps = a.components.map((c) => ({
        pack_lot_id: lot.id,
        bulk_lot_id: c.bulkLotId,
        pouches_used: c.pouches,
      }));
      await tx`insert into slime.pack_components ${tx(comps)}`;
    }
  });
  return lotCode;
}

export interface PackLotRow {
  id: number;
  lotCode: string;
  packedOn: string;
  variantId: string;
  fnsku: string | null;
  kits: number;
  packedBy: string | null;
  components: { lotCode: string; color: SlimeColor; pouches: number }[];
}

export async function listPackLots(lotCode?: string): Promise<PackLotRow[]> {
  const db = sql();
  const rows = await db`
    select p.id, p.lot_code, p.packed_on, p.variant_id, p.fnsku, p.kits, p.packed_by,
           coalesce(json_agg(json_build_object('lotCode', b.lot_code, 'color', b.color,
                    'pouches', c.pouches_used) order by b.color, b.lot_code)
                    filter (where b.id is not null), '[]') as components
    from slime.pack_lots p
    left join slime.pack_components c on c.pack_lot_id = p.id
    left join slime.bulk_lots b on b.id = c.bulk_lot_id
    ${lotCode ? db`where p.lot_code = ${lotCode}` : db``}
    group by p.id
    order by p.packed_on desc, p.run_no desc, p.variant_id`;
  return rows.map((r) => ({
    id: Number(r.id),
    lotCode: r.lot_code,
    packedOn: iso(r.packed_on),
    variantId: r.variant_id,
    fnsku: r.fnsku,
    kits: r.kits,
    packedBy: r.packed_by,
    components: r.components,
  }));
}

export { PACK_COLORS };

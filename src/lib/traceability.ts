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
import { packKits, bulkLotCode, packLotCode, yymmdd, COLOR_CODE, type Balance } from "@/lib/lots";

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

/** One mixing run: the four color lots that share a date and run number. */
export interface Batch {
  key: string; // YYMMDD-RUN, e.g. 261120-43
  madeOn: string;
  runNo: number;
  lots: Partial<Record<SlimeColor, BulkLotRow>>;
  remaining: Counts;
}

export async function listBatches(): Promise<Batch[]> {
  const out = new Map<string, Batch>();
  for (const l of await listBulkLots()) {
    const key = `${yymmdd(l.madeOn)}-${String(l.runNo).padStart(2, "0")}`;
    let b = out.get(key);
    if (!b) {
      b = { key, madeOn: l.madeOn, runNo: l.runNo, lots: {}, remaining: { red: 0, yellow: 0, green: 0, blue: 0 } };
      out.set(key, b);
    }
    b.lots[l.color] = l;
    b.remaining[l.color] += l.pouchesRemaining;
  }
  return [...out.values()];
}

export async function nextBulkRunNo(): Promise<number> {
  const [r] = await sql()`select coalesce(max(run_no), 0) + 1 as n from slime.bulk_lots`;
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
 * Correct how many pouches a batch's lots were filled with. Never below what
 * has already been packed from a lot. Each change is noted on the lot.
 */
export async function updateBulkFilled(changes: { id: number; filled: number }[]): Promise<void> {
  if (changes.length === 0) return;
  await sql().begin(async (tx) => {
    const ids = changes.map((c) => c.id);
    await tx`select id from slime.bulk_lots where id in ${tx(ids)} for update`;
    const rows = await tx`
      select id, lot_code, pouches_filled, pouches_used from slime.bulk_lot_balances
      where id in ${tx(ids)}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    for (const c of changes) {
      const r = rows.find((x) => Number(x.id) === c.id);
      if (!r) throw new Error("That lot no longer exists.");
      if (!Number.isInteger(c.filled) || c.filled < 0) throw new Error(`${r.lot_code}: enter a whole number.`);
      if (c.filled < r.pouches_used) {
        throw new Error(`${r.lot_code}: ${r.pouches_used} already packed, so it can't be less than that.`);
      }
      if (c.filled === r.pouches_filled) continue;
      await tx`
        update slime.bulk_lots
        set pouches_filled = ${c.filled},
            notes = concat_ws(' · ', nullif(notes, ''),
                              ${`filled corrected ${r.pouches_filled}→${c.filled} on ${today}`}::text)
        where id = ${c.id}`;
    }
  });
}

/**
 * Record a packing run from the chosen bulk lots. Kits are grouped by the
 * exact lots they hold (see packKits); each group is one row with the code
 * its labels print. The balance read and the inserts share a transaction with
 * the bulk lots locked, so two people packing at once can't spend the same
 * pouches or mint the same MP code. Returns the packing run number.
 */
export async function createPackRun(input: {
  packedOn: string;
  plan: Plan;
  lotIds: number[];
  packedBy?: string;
}): Promise<number> {
  if (input.lotIds.length === 0) throw new Error("Pick at least one batch to pack from.");
  return sql().begin(async (tx) => {
    await tx`select id from slime.bulk_lots for update`;
    const bal = await tx`
      select id, lot_code, color, made_on, pouches_remaining
      from slime.bulk_lot_balances where id in ${tx(input.lotIds)}`;
    const balances: Balance[] = bal.map((b) => ({
      id: Number(b.id),
      lotCode: b.lot_code,
      color: b.color,
      madeOn: iso(b.made_on),
      remaining: b.pouches_remaining,
    }));
    const groups = packKits(balances, input.plan);

    const [{ run }] = await tx`select coalesce(max(run_no), 0) + 1 as run from slime.pack_lots`;
    const [{ mp }] = await tx`
      select coalesce(max(substring(lot_code from '[0-9]+$')::int), 0) as mp
      from slime.pack_lots where lot_code ~ '^MP-[0-9]{6}-[0-9]+$'`;
    let nextMp = mp + 1;

    for (const g of groups) {
      const v = PACK_VARIANTS.find((x) => x.id === g.variantId)!;
      const code = g.bulkCode ?? packLotCode(input.packedOn, nextMp++);
      const [row] = await tx`
        insert into slime.pack_lots (lot_code, packed_on, run_no, variant_id, fnsku, kits, packed_by)
        values (${code}, ${input.packedOn}, ${run}, ${v.id}, ${v.fnsku}, ${g.kits},
                ${input.packedBy || null})
        returning id`;
      await tx`insert into slime.pack_components ${tx(
        g.perKit.map((p) => ({
          pack_lot_id: row.id,
          bulk_lot_id: p.bulkLotId,
          pouches_used: p.pouches * g.kits,
        }))
      )}`;
    }
    return Number(run);
  });
}

export interface PackLotRow {
  id: number;
  runNo: number;
  lotCode: string;
  packedOn: string;
  variantId: string;
  fnsku: string | null;
  kits: number;
  packedBy: string | null;
  components: { lotCode: string; color: SlimeColor; pouches: number }[];
}

export async function listPackLots(runNo?: number): Promise<PackLotRow[]> {
  const db = sql();
  const rows = await db`
    select p.id, p.run_no, p.lot_code, p.packed_on, p.variant_id, p.fnsku, p.kits, p.packed_by,
           coalesce(json_agg(json_build_object('lotCode', b.lot_code, 'color', b.color,
                    'pouches', c.pouches_used) order by b.color, b.lot_code)
                    filter (where b.id is not null), '[]') as components
    from slime.pack_lots p
    left join slime.pack_components c on c.pack_lot_id = p.id
    left join slime.bulk_lots b on b.id = c.bulk_lot_id
    ${runNo ? db`where p.run_no = ${runNo}` : db``}
    group by p.id
    order by p.packed_on desc, p.run_no desc, p.variant_id`;
  return rows.map((r) => ({
    id: Number(r.id),
    runNo: r.run_no,
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

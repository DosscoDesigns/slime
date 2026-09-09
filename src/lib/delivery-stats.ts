/**
 * How long orders actually take.
 *
 * PURE — no Stripe, no Shippo, no React. Every timestamp it reads was already
 * cached on the order, so the whole aggregate costs zero API calls.
 *
 * Three durations rather than one, because "delivery time" is three different
 * questions and only one of them is actionable:
 *
 *   handling  paid -> label bought.        OURS. The only one we control.
 *   transit   first carrier scan -> delivered.  The carrier's.
 *   total     paid -> delivered.           What the customer actually lived.
 *
 * Reporting only `total` would blame USPS for a parcel that sat on our table
 * for two days; reporting only `transit` would hide it entirely.
 */
import type { Order } from "@/lib/orders";

export interface OrderDurations {
  handlingHours: number | null;
  transitHours: number | null;
  totalHours: number | null;
}

const HOUR_MS = 3_600_000;

function hoursBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  // A negative span means clock skew or a carrier backdating a scan. Drop it
  // rather than letting a nonsense value drag an average around.
  return ms < 0 ? null : ms / HOUR_MS;
}

export function orderDurations(o: Order): OrderDurations {
  const delivered = o.tracking?.deliveredAt ?? null;
  return {
    handlingHours: hoursBetween(o.createdAt, o.labelBoughtAt),
    // Explicitly from the first TRANSIT scan, never from PRE_TRANSIT: USPS
    // emits "Shipping Label Created" as PRE_TRANSIT dated at label creation,
    // so measuring from it would quietly turn transit time into total time.
    transitHours: hoursBetween(o.tracking?.transitStartedAt ?? null, delivered),
    totalHours: hoursBetween(o.createdAt, delivered),
  };
}

/** Median, not mean. At n≈10 a single stuck parcel destroys an average. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface DeliveryStats {
  /** Orders with a delivery timestamp — the sample these medians rest on. */
  n: number;
  medianHandlingHours: number | null;
  medianTransitHours: number | null;
  medianTotalHours: number | null;
  slowest: { orderId: string; hours: number } | null;
}

export function deliveryStats(orders: Order[]): DeliveryStats {
  const delivered = orders.filter((o) => o.tracking?.deliveredAt);
  const durations = delivered.map((o) => ({ o, d: orderDurations(o) }));

  const pick = (key: keyof OrderDurations): number[] =>
    durations.map(({ d }) => d[key]).filter((v): v is number => v !== null);

  let slowest: DeliveryStats["slowest"] = null;
  for (const { o, d } of durations) {
    if (d.totalHours !== null && (!slowest || d.totalHours > slowest.hours)) {
      slowest = { orderId: o.id, hours: d.totalHours };
    }
  }

  return {
    n: delivered.length,
    medianHandlingHours: median(pick("handlingHours")),
    medianTransitHours: median(pick("transitHours")),
    medianTotalHours: median(pick("totalHours")),
    slowest,
  };
}

/** "1.5 days" / "18 hours" / "—". Days once it passes two, hours below that. */
export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${Math.round(hours)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

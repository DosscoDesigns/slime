/**
 * Client for the DD print worker — the service on dd-mini that pipes ZPL to
 * Jason's Zebra label printers.
 *
 * ─── THIS MODULE IS SERVER-ONLY. ───────────────────────────────────────────
 *
 * PRINT_WORKER_TOKEN is a shared secret. It must never reach the browser, so
 * it deliberately has no NEXT_PUBLIC_ prefix and this module must only ever be
 * imported from a route handler or server component. An admin screen that
 * wants to print calls OUR api route, which calls the worker; the browser
 * never talks to the worker directly.
 *
 * This is not hypothetical: the DD admin panel currently ships a Supabase
 * service-role key in its client bundle because a server secret was read from
 * browser-side code. Same shape, same cause. Don't add a second one.
 *
 * The worker itself lives in ~/dev/dd/infra/print-worker and is owned by the
 * dd session, not this repo. Contract (fixed by dd, 2026-09-08):
 *   POST /print/zpl  ·  header X-Print-Token  ·  body {zpl, printer}
 *   401 on a missing or wrong token, with no print attempted
 *   GET /health stays open and unauthenticated
 */

/** The two label printers the worker knows about. 4x6 is shipping labels. */
export type ZebraPrinter = "4x2" | "4x6";

export class PrintWorkerError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "PrintWorkerError";
  }
}

function assertServerSide(): void {
  if (typeof window !== "undefined") {
    throw new PrintWorkerError(
      "print.ts was imported into browser code — PRINT_WORKER_TOKEN must never ship to the client"
    );
  }
}

export function assertPrintWorkerConfigured(): void {
  if (!process.env.PRINT_WORKER_URL || !process.env.PRINT_WORKER_TOKEN) {
    throw new PrintWorkerError(
      "print worker is not configured (need PRINT_WORKER_URL, PRINT_WORKER_TOKEN)"
    );
  }
}

/**
 * The worker's own worst-case time before it gives up: 3 attempts capped at
 * 8s each, 600ms apart (see sendZPL in ~/dev/dd/infra/print-worker/server.js).
 * It retries because the Zebras WiFi-sleep and refuse the first connect.
 */
export const WORKER_RETRY_BUDGET_MS = 3 * 8_000 + 2 * 600; // 25.2s

/**
 * Deliberately LONGER than WORKER_RETRY_BUDGET_MS, and that ordering is the
 * whole point — do not "tidy" this back down to a rounder number.
 *
 * Aborting our fetch does not abort the worker: its `nc` child keeps running
 * and can still put a label on the roll. So if we give up first, we tell the
 * caller the print failed while a label is in flight, the admin retries, and
 * the customer's box gets two labels. Whoever gives up first must be the party
 * that cannot cause a side effect — here that is the worker, not us.
 */
export const DEFAULT_PRINT_TIMEOUT_MS = 30_000;

interface PrintZplParams {
  zpl: string;
  printer: ZebraPrinter;
  /**
   * Give up after this long. Anything below WORKER_RETRY_BUDGET_MS reopens the
   * duplicate-label window described on DEFAULT_PRINT_TIMEOUT_MS.
   */
  timeoutMs?: number;
}

/**
 * Send raw ZPL to a printer and resolve once the worker has handed it off.
 *
 * The worker retries internally — the Zebras WiFi-sleep and refuse the first
 * connect — so the default timeout is generous enough to cover that rather
 * than racing it. A rejection here means the label did NOT print; callers
 * should surface that rather than assume a label exists.
 */
export async function printZpl({
  zpl,
  printer,
  timeoutMs = DEFAULT_PRINT_TIMEOUT_MS,
}: PrintZplParams): Promise<void> {
  assertServerSide();
  assertPrintWorkerConfigured();

  if (!zpl.trim()) throw new PrintWorkerError("refusing to print empty ZPL");

  const base = process.env.PRINT_WORKER_URL!.replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${base}/print/zpl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Print-Token": process.env.PRINT_WORKER_TOKEN!,
      },
      body: JSON.stringify({ zpl, printer }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Separate the two failures, because they need opposite responses.
    //
    // A timeout means the worker took the job and we stopped listening — the
    // label MAY have printed, so the operator must look at the printer before
    // retrying. A connect failure means the request never landed and a retry
    // is safe. Collapsing both into "unreachable" is what sends someone to
    // check the network when they should be checking the roll.
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new PrintWorkerError(
        `print worker did not answer within ${timeoutMs}ms — the label MAY have printed anyway; check the printer before retrying`
      );
    }
    throw new PrintWorkerError(
      `print worker unreachable (dd-mini asleep, off-network, or tunnel down): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (res.status === 401) {
    throw new PrintWorkerError(
      "print worker rejected the token — PRINT_WORKER_TOKEN is wrong or unset on this deploy",
      401
    );
  }

  if (!res.ok) {
    throw new PrintWorkerError(
      `print worker ${res.status}: ${(await res.text()).slice(0, 300)}`,
      res.status
    );
  }
}

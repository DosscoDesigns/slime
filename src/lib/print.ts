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
 * A COPY of the worker's worst case, for when we cannot ask it: 3 attempts
 * capped at 8s each, 600ms apart (sendZPL in ~/dev/dd/infra/print-worker).
 * It retries because the Zebras WiFi-sleep and refuse the first connect.
 *
 * This number lives on the wrong side of a boundary and we know it. The retry
 * loop is in another repo, owned by another session, and nothing here can see
 * it change — if `attempts` goes 3 → 4 the real budget becomes 33.6s and this
 * constant is silently wrong. So treat it as a floor for the offline case,
 * never as the truth: the live value comes from fetchWorkerRetryBudgetMs().
 *
 * There is deliberately NO unit test pinning this to 25_200. Such a test only
 * asserts that we transcribed someone else's constant correctly, which never
 * fails and never helps — and would sit green through exactly the change that
 * reopens the duplicate-label window.
 */
export const FALLBACK_WORKER_RETRY_BUDGET_MS = 3 * 8_000 + 2 * 600; // 25.2s

/**
 * Deliberately LONGER than the worker's retry budget, and that ordering is the
 * whole point — do not "tidy" this back down to a rounder number.
 *
 * Aborting our fetch does not abort the worker: its `nc` child keeps running
 * and can still put a label on the roll. So if we give up first, we tell the
 * caller the print failed while a label is in flight, the admin retries, and
 * the customer's box gets two labels. Whoever gives up first must be the party
 * that cannot cause a side effect — here that is the worker, not us.
 *
 * Verify this against the LIVE budget with assertTimeoutCoversWorker(), not
 * against FALLBACK_WORKER_RETRY_BUDGET_MS. Comparing two of our own constants
 * proves nothing about the worker.
 */
export const DEFAULT_PRINT_TIMEOUT_MS = 30_000;

/**
 * Read the worker's own declared retry budget from its open /health endpoint.
 *
 * Returns null when the worker cannot be reached OR when it does not publish
 * `retryBudgetMs` — older builds return a bare `{"status":"ok"}`, so absence
 * is a supported answer, not an error. Callers fall back to
 * FALLBACK_WORKER_RETRY_BUDGET_MS.
 *
 * /health is unauthenticated by contract, so this needs no token.
 */
export async function fetchWorkerRetryBudgetMs(): Promise<number | null> {
  assertServerSide();
  if (!process.env.PRINT_WORKER_URL) return null;

  const base = process.env.PRINT_WORKER_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { retryBudgetMs?: unknown };
    return typeof body.retryBudgetMs === "number" && body.retryBudgetMs > 0
      ? body.retryBudgetMs
      : null;
  } catch {
    return null;
  }
}

/**
 * Check our timeout still outlives the worker's ACTUAL budget.
 *
 * This is the guard the unit tests cannot be: it reads the live value rather
 * than a constant we copied. Deliberately NOT called from printZpl() — that
 * would put a second round-trip in front of every label for a value that
 * changes about never. Call it at startup, from an ops check, or from the
 * post-deploy acceptance gate.
 *
 * Silent when the worker does not publish a budget; there is nothing to check
 * and failing closed would ground printing over a missing diagnostic field.
 */
export async function assertTimeoutCoversWorker(
  timeoutMs: number = DEFAULT_PRINT_TIMEOUT_MS
): Promise<void> {
  const live = await fetchWorkerRetryBudgetMs();
  if (live === null) return;
  if (timeoutMs <= live) {
    throw new PrintWorkerError(
      `print timeout ${timeoutMs}ms does not cover the worker's retry budget of ${live}ms — ` +
        `a print can succeed after we report failure, which duplicates labels. Raise DEFAULT_PRINT_TIMEOUT_MS above ${live}.`
    );
  }
}

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

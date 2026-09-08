/**
 * Acceptance gate for the print worker (DosscoDesigns/infra fix/print-worker-auth).
 *
 * Run AFTER Jason approves the deploy and ops restarts the LaunchAgent. Four
 * checks, agreed with the dd session, costing ONE label in total.
 *
 * The limiter sits AFTER auth, so any request that passes the token check and
 * the cap PRINTS. Bursting a 30/min cap to find its edge would put 30 labels on
 * the floor — which is why the cap is turned down for the gate instead. That is
 * not optional cleverness; it is the difference between one label and a roll.
 *
 *   node scripts/print-gate.mjs 401       # no env change needed
 *   node scripts/print-gate.mjs limit0    # worker at PRINT_WORKER_RATE_MAX=0
 *   node scripts/print-gate.mjs limit1    # worker at PRINT_WORKER_RATE_MAX=1  <- the one label
 *   node scripts/print-gate.mjs health    # no env change needed
 *
 * Between phases the WORKER's env changes and ops restarts it; this script only
 * drives the client side. It cannot restore the cap for you — see the closing
 * reminder, and do not leave a worker at 1/min or the second real order of the
 * day 429s and looks like a bug.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
registerHooks({
  resolve(s, c, n) {
    if (s.startsWith("@/"))
      return { url: pathToFileURL(path.join(ROOT, "src", `${s.slice(2)}.ts`)).href, shortCircuit: true };
    return n(s, c);
  },
});

const op = (ref) => execFileSync("op", ["read", ref], { encoding: "utf8" }).trim();
const envLocal = path.join(ROOT, ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[m[1]] = v.startsWith("op://") ? op(v) : v;
  }
}

const { assertTimeoutCoversWorker, fetchWorkerRetryBudgetMs, DEFAULT_PRINT_TIMEOUT_MS } = await import(
  path.join(ROOT, "src/lib/print.ts")
);

const BASE = process.env.PRINT_WORKER_URL.replace(/\/$/, "");
const TOKEN = process.env.PRINT_WORKER_TOKEN;

/** A small, unmistakable label so a stray print is identifiable, not mystery paper. */
const GATE_ZPL =
  "^XA^CI28^LH20,20^FO0,40^A0N,60,60^FDPRINT GATE^FS" +
  `^FO0,120^A0N,34,34^FD${new Date().toISOString()}^FS` +
  "^FO0,180^A0N,34,34^FDdd-mini acceptance check^FS^XZ";

async function post(token, zpl = GATE_ZPL) {
  const res = await fetch(`${BASE}/print/zpl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "X-Print-Token": token } : {}) },
    body: JSON.stringify({ zpl, printer: "4x6" }),
    signal: AbortSignal.timeout(35_000),
  });
  return { status: res.status, body: (await res.text()).slice(0, 200) };
}

const phase = process.argv[2];
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { console.log(`  FAIL  ${m}`); process.exitCode = 1; };
// A check that could not run is NOT a pass. assertTimeoutCoversWorker() is
// deliberately silent when the worker publishes no budget, so calling that
// "PASS" would report success for something never verified.
const skip = (m) => { console.log(`  SKIP  ${m}`); process.exitCode = 1; };

console.log(`\ngate phase "${phase}" against ${BASE}\n`);

if (phase === "401") {
  // A wrong token must be refused BEFORE the print path — the point is that
  // nothing comes out, not merely that the status code is 401.
  const wrong = await post("definitely-not-the-token");
  wrong.status === 401 ? ok(`wrong token -> 401 (${wrong.body})`) : bad(`wrong token -> ${wrong.status} ${wrong.body}`);
  const none = await post(undefined);
  none.status === 401 ? ok("missing token -> 401") : bad(`missing token -> ${none.status} ${none.body}`);
  console.log("\n  CHECK THE PRINTER: nothing should have printed.\n");
} else if (phase === "limit0") {
  const r = await post(TOKEN);
  r.status === 429 ? ok(`valid token at cap 0 -> 429 (${r.body})`) : bad(`expected 429, got ${r.status} ${r.body}`);
  console.log("\n  CHECK THE PRINTER: nothing should have printed.\n");
} else if (phase === "limit1") {
  // Proves the limiter ALLOWS under the cap, which the cap-0 check cannot.
  // This first request is also the gate's one real label.
  const first = await post(TOKEN);
  first.status === 200 ? ok("first request at cap 1 -> 200, one label printed") : bad(`expected 200, got ${first.status} ${first.body}`);
  const second = await post(TOKEN);
  second.status === 429 ? ok(`second request -> 429 (${second.body})`) : bad(`expected 429, got ${second.status} ${second.body}`);
  console.log("\n  CHECK THE PRINTER: exactly ONE label reading PRINT GATE.\n");
} else if (phase === "health") {
  const live = await fetchWorkerRetryBudgetMs();
  if (live === null) {
    bad("/health published no retryBudgetMs — the deploy did not land, or the field is missing");
    skip("timeout-vs-live-budget not checked: there is no live budget to compare against");
  } else {
    ok(`/health publishes retryBudgetMs=${live}`);
    try {
      await assertTimeoutCoversWorker();
      ok(`our ${DEFAULT_PRINT_TIMEOUT_MS}ms default covers the live budget of ${live}ms`);
    } catch (e) {
      bad(e.message);
    }
  }
} else {
  console.error("phase must be one of: 401 | limit0 | limit1 | health");
  process.exit(1);
}

if (phase === "limit0" || phase === "limit1") {
  console.log("  REMEMBER: restore PRINT_WORKER_RATE_MAX=30 (or remove the line) and restart.");
  console.log("  A worker left at 1/min will 429 the second real order of the day.\n");
}

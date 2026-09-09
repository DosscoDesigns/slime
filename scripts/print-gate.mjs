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

/**
 * Confirm the worker is in the state a phase assumes BEFORE sending anything
 * that carries a valid token.
 *
 * A POST with a matching credential is a loaded call, not neutral setup: it
 * clears auth, and if the precondition silently is not in place it clears the
 * cap too and prints. The limit0 phase is the sharp case — its whole assertion
 * is "nothing came out", so it is the one phase that must never be the thing
 * that prints. Verify, then fire.
 *
 * /health is the only safe probe: it is unauthenticated and has no print path
 * behind it.
 */
async function preflight(expectedCap) {
  let res, body;
  try {
    res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(10_000) });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    console.log(`  ABORT  /health unreachable: ${e.message}`);
    console.log("         If the deploy moved the port, the cloudflared ingress may not have followed.\n");
    process.exit(1);
  }

  if (res.status !== 200) {
    // Since 88a4b91 a bad env value fails closed rather than disabling the
    // limiter, so a degraded worker here means a config error, not a bug.
    console.log(`  ABORT  /health ${res.status}: ${body.reason ?? JSON.stringify(body)}`);
    console.log("         Worker is degraded — fix the env value it names, restart, re-run.\n");
    process.exit(1);
  }

  // Version signal FIRST, and note this was available before rateLimitMax
  // existed: the pre-auth worker returns a bare {"status":"ok"}, so the mere
  // presence of retryBudgetMs distinguishes old from new. The preflight that
  // printed a label could have gated on this and refused. It warned instead.
  // The check was not missing; it was not reached for.
  if (typeof body.retryBudgetMs !== "number") {
    console.log("  ABORT  /health has no retryBudgetMs — this is the OLD pre-auth worker.");
    console.log("         It has NO token check and NO rate limit, so any request that");
    console.log("         reaches /print/zpl prints. The auth deploy has not landed.\n");
    process.exit(1);
  }

  if (expectedCap === undefined) return;

  // Absence means UNKNOWN, never a default. When a config value fails to parse
  // the worker omits rateLimitMax rather than reporting the fallback, because a
  // plausible number that is not the operator's number is worse than none.
  if (typeof body.rateLimitMax !== "number") {
    console.log(`  ABORT  worker is degraded and does not publish rateLimitMax: ${body.reason ?? "(no reason given)"}`);
    console.log("         A config value failed to parse, so the cap is UNKNOWN — not defaulted.");
    console.log("         Fix the variable it names, restart, re-run.\n");
    process.exit(1);
  }

  if (body.rateLimitMax !== expectedCap) {
    console.log(`  ABORT  worker reports rateLimitMax=${body.rateLimitMax}, this phase needs ${expectedCap}.`);
    console.log("         Set it, restart, re-run. Firing now would print a label the phase claims it did not.\n");
    process.exit(1);
  }
  console.log(`  ok    worker confirms rateLimitMax=${body.rateLimitMax}`);
}

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
const configErr = (r) =>
  r.status === 503 && /bad configuration|not configured/i.test(r.body);
const bad = (m) => { console.log(`  FAIL  ${m}`); process.exitCode = 1; };
// A check that could not run is NOT a pass. assertTimeoutCoversWorker() is
// deliberately silent when the worker publishes no budget, so calling that
// "PASS" would report success for something never verified.
const skip = (m) => { console.log(`  SKIP  ${m}`); process.exitCode = 1; };

console.log(`\ngate phase "${phase}" against ${BASE}\n`);

if (phase === "401") {
  await preflight();
  // A wrong token must be refused BEFORE the print path — the point is that
  // nothing comes out, not merely that the status code is 401.
  const wrong = await post("definitely-not-the-token");
  wrong.status === 401 ? ok(`wrong token -> 401 (${wrong.body})`) : bad(`wrong token -> ${wrong.status} ${wrong.body}`);
  const none = await post(undefined);
  none.status === 401 ? ok("missing token -> 401") : bad(`missing token -> ${none.status} ${none.body}`);
  console.log("\n  CHECK THE PRINTER: nothing should have printed.\n");
} else if (phase === "limit0") {
  await preflight(0);
  const r = await post(TOKEN);
  if (configErr(r)) bad(`worker refused on config, not the limiter: ${r.body}`);
  else if (r.status === 429) ok(`valid token at cap 0 -> 429 (${r.body})`);
  else bad(`expected 429, got ${r.status} ${r.body}${r.status === 200 ? " — A LABEL PRINTED; the cap was not applied" : ""}`);
  console.log("\n  CHECK THE PRINTER: nothing should have printed.\n");
} else if (phase === "limit1") {
  await preflight(1);
  // Proves the limiter ALLOWS under the cap, which the cap-0 check cannot.
  // This first request is also the gate's one real label.
  const first = await post(TOKEN);
  if (configErr(first)) bad(`worker refused on config, not the limiter: ${first.body}`);
  else first.status === 200
    ? ok("first request at cap 1 -> 200, one label printed")
    : bad(`expected 200, got ${first.status} ${first.body}`);
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
    // The restore step is the one that gets forgotten, and its failure mode is
    // a customer's second order of the day 429ing and reading as a bug. With
    // the cap published, that state is observable here instead.
    const h = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => ({}));
    if (typeof h.rateLimitMax !== "number") {
      console.log("  WARN  /health does not publish rateLimitMax — cannot confirm the cap was restored.");
    } else if (h.rateLimitMax !== 30) {
      bad(`rateLimitMax is ${h.rateLimitMax}, not the normal 30 — a gate setting was left in place`);
    } else {
      ok("rateLimitMax=30 — the gate's cap override was restored");
    }
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

// Structured logging to BetterStack Telemetry.
//
// Vercel's own runtime logs are the only other record and they age out fast,
// so anything we want to be able to answer a question about later — above all
// "did the customer get their order email?" — has to be shipped here.
//
// Three invariants this module exists to enforce:
//
//   1. Logging NEVER breaks a request, and never delays one for long. Every
//      send is bounded by SHIP_TIMEOUT_MS; a failure is swallowed after being
//      written to console. An order must not fail, or hang, because the log
//      sink is down.
//   2. console.* still happens regardless. BetterStack is additive; the Vercel
//      log stays the fallback when the token is unset (local dev, previews).
//   3. Customer PII is redacted before it leaves the process. Email addresses
//      are reduced to a coarse shape — enough to correlate, not enough to be
//      a copy of the customer list sitting in a third-party log store.
//
// Shape note for anyone copying this: fire-per-event is the right call on
// serverless with low request volume, because each invocation is isolated and
// a buffer that outlives the response is a buffer that gets dropped. On a
// long-lived Node server, batch on an interval instead.

import { after } from "next/server";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const INGEST_HOST = process.env.BETTERSTACK_INGEST_HOST;
const SOURCE_TOKEN = process.env.BETTERSTACK_SOURCE_TOKEN;

/**
 * Anything below this is written to console but not shipped. Defaults to
 * "info" so the deliberate success signals still land; set LOG_LEVEL=warn to
 * cut volume, or "debug" locally.
 */
const THRESHOLD: number =
  LEVEL_RANK[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVEL_RANK.info;

/**
 * Bounds how long a request can be held up by the log sink. Chosen well under
 * Stripe's webhook read timeout, because the mailgun-failure path awaits a
 * send before responding.
 */
const SHIP_TIMEOUT_MS = 2000;

export const loggingConfigured = Boolean(INGEST_HOST && SOURCE_TOKEN);

type Context = Record<string, unknown>;

/** `jason@dossweb.com` -> `j***@dossweb.com`. Correlatable, not harvestable. */
function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return "***";
  return `${value[0]}***${value.slice(at)}`;
}

const EMAIL_KEYS = new Set([
  "to",
  "bcc",
  "email",
  "customer_email",
  "notification_email",
  "receipt_email",
]);

function redact(context?: Context): Context | undefined {
  if (!context) return undefined;
  const out: Context = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] =
      EMAIL_KEYS.has(k) && typeof v === "string"
        ? v.split(",").map((s) => maskEmail(s.trim())).join(",")
        : v;
  }
  return out;
}

function consoleWrite(level: Level, message: string, context?: Context) {
  const line = `[${level}] ${message}`;
  if (level === "error") console.error(line, context ?? "");
  else if (level === "warn") console.warn(line, context ?? "");
  else console.log(line, context ?? "");
}

async function ship(level: Level, message: string, context?: Context) {
  try {
    const res = await fetch(`https://${INGEST_HOST}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SOURCE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dt: new Date().toISOString(),
        level,
        message,
        service: "slime",
        env: process.env.VERCEL_ENV ?? "development",
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
        ...context,
      }),
      signal: AbortSignal.timeout(SHIP_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        `betterstack ingest ${res.status} ${res.statusText}: ${await res.text()}`
      );
    }
  } catch (err) {
    // Deliberately terminal. Never rethrow — see invariant 1 above.
    console.error(
      "betterstack ship failed:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Fire-and-forget structured log.
 *
 * The returned promise is exposed so a caller on a path that is about to
 * return a response can await it, but callers are not required to: the send
 * is registered with `after()` so Vercel keeps the function alive until it
 * settles. `after()` throws outside a request scope, hence the fallback.
 *
 * Awaiting is safe precisely because `ship()` is timeout-bounded and cannot
 * reject.
 */
export function log(
  level: Level,
  message: string,
  context?: Context
): Promise<void> {
  const safe = redact(context);
  consoleWrite(level, message, safe);
  if (!loggingConfigured || LEVEL_RANK[level] < THRESHOLD) {
    return Promise.resolve();
  }

  const pending = ship(level, message, safe);
  try {
    after(pending);
  } catch {
    // Not in a request scope (build, script, module init). The promise still
    // runs; it just has no runtime keeping it alive.
  }
  return pending;
}

export const logInfo = (m: string, c?: Context) => log("info", m, c);
export const logWarn = (m: string, c?: Context) => log("warn", m, c);
export const logError = (m: string, c?: Context) => log("error", m, c);

/** Normalizes a thrown value into something JSON-serializable. */
export function errorContext(err: unknown): Context {
  if (err instanceof Error) {
    return { error: err.message, error_name: err.name, stack: err.stack };
  }
  return { error: String(err) };
}

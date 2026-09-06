// Structured logging to BetterStack Telemetry.
//
// Vercel's own runtime logs are the only other record and they age out fast,
// so anything we want to be able to answer a question about later — above all
// "did the customer get their order email?" — has to be shipped here.
//
// Two rules this module exists to enforce:
//
//   1. Logging NEVER breaks a request. A shipping failure is swallowed after
//      being written to console. An order must not fail because the log sink
//      is down.
//   2. console.* still happens regardless. BetterStack is additive; the Vercel
//      log stays the fallback when the token is unset (local dev, previews).

import { after } from "next/server";

type Level = "debug" | "info" | "warn" | "error";

const INGEST_HOST = process.env.BETTERSTACK_INGEST_HOST;
const SOURCE_TOKEN = process.env.BETTERSTACK_SOURCE_TOKEN;

export const loggingConfigured = Boolean(INGEST_HOST && SOURCE_TOKEN);

type Context = Record<string, unknown>;

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
    });
    if (!res.ok) {
      console.error(
        `betterstack ingest ${res.status} ${res.statusText}: ${await res.text()}`
      );
    }
  } catch (err) {
    // Deliberately terminal. Never rethrow — see rule 1 above.
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
 */
export function log(
  level: Level,
  message: string,
  context?: Context
): Promise<void> {
  consoleWrite(level, message, context);
  if (!loggingConfigured) return Promise.resolve();

  const pending = ship(level, message, context);
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

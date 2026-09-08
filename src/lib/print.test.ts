import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  printZpl,
  assertPrintWorkerConfigured,
  PrintWorkerError,
  DEFAULT_PRINT_TIMEOUT_MS,
  FALLBACK_WORKER_RETRY_BUDGET_MS,
  fetchWorkerRetryBudgetMs,
  assertTimeoutCoversWorker,
} from "./print";

/**
 * The token in these tests is the whole point of the module: it must be sent
 * as a header on every print, and it must never be reachable from the client.
 * See the header comment in print.ts for why that matters here specifically.
 */

const URL_ = "https://print.example.com";
const TOKEN = "test-token-abc";

beforeEach(() => {
  process.env.PRINT_WORKER_URL = URL_;
  process.env.PRINT_WORKER_TOKEN = TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PRINT_WORKER_URL;
  delete process.env.PRINT_WORKER_TOKEN;
});

function stubFetch(response: Response) {
  const spy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("assertPrintWorkerConfigured", () => {
  it("passes when both vars are set", () => {
    expect(() => assertPrintWorkerConfigured()).not.toThrow();
  });

  it("throws when the token is missing", () => {
    delete process.env.PRINT_WORKER_TOKEN;
    expect(() => assertPrintWorkerConfigured()).toThrow(/not configured/);
  });
});

describe("printZpl", () => {
  it("sends the token as X-Print-Token, not in the body or the URL", async () => {
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await printZpl({ zpl: "^XA^XZ", printer: "4x6" });

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe(`${URL_}/print/zpl`);
    expect(init.headers["X-Print-Token"]).toBe(TOKEN);
    expect(url).not.toContain(TOKEN);
    expect(init.body).not.toContain(TOKEN);
  });

  it("posts the zpl and the chosen printer", async () => {
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await printZpl({ zpl: "^XA test ^XZ", printer: "4x6" });

    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
      zpl: "^XA test ^XZ",
      printer: "4x6",
    });
  });

  it("tolerates a trailing slash on the configured URL", async () => {
    process.env.PRINT_WORKER_URL = `${URL_}/`;
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await printZpl({ zpl: "^XA^XZ", printer: "4x2" });
    expect(spy.mock.calls[0][0]).toBe(`${URL_}/print/zpl`);
  });

  it("refuses to print empty ZPL before making a request", async () => {
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await expect(printZpl({ zpl: "   ", printer: "4x6" })).rejects.toThrow(
      /empty ZPL/
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("will not attempt a print when it is not configured", async () => {
    delete process.env.PRINT_WORKER_TOKEN;
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await expect(printZpl({ zpl: "^XA^XZ", printer: "4x6" })).rejects.toThrow(
      /not configured/
    );
    expect(spy).not.toHaveBeenCalled();
  });

  // A 401 means the deploy's token is wrong, which a human has to fix; saying
  // so beats a generic "print failed" that reads like a sleeping printer.
  it("names the token as the cause on a 401", async () => {
    stubFetch(new Response("unauthorized", { status: 401 }));
    await expect(printZpl({ zpl: "^XA^XZ", printer: "4x6" })).rejects.toThrow(
      /PRINT_WORKER_TOKEN/
    );
  });

  it("reports a failed print as an error rather than resolving", async () => {
    stubFetch(new Response("nc exit 1", { status: 500 }));
    await expect(
      printZpl({ zpl: "^XA^XZ", printer: "4x6" })
    ).rejects.toBeInstanceOf(PrintWorkerError);
  });

  it("turns an unreachable worker into a clear error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(printZpl({ zpl: "^XA^XZ", printer: "4x6" })).rejects.toThrow(
      /unreachable/
    );
  });
});

/**
 * The client must outlive the worker's own retry budget. If it gives up first
 * its abort does NOT stop the worker — the label still prints, the caller is
 * told it failed, and a retry puts two labels on one box. Same class of bug as
 * reading an idempotency flag off a stale snapshot: the action completes
 * outside the window being watched.
 *
 * NOTE what is deliberately NOT tested here: that
 * FALLBACK_WORKER_RETRY_BUDGET_MS equals 25,200. That constant is a copy of a
 * value owned by another repo, so such a test would only assert our own
 * transcription — it passes forever, including through the exact change (the
 * worker raising `attempts` 3 → 4) that reopens the duplicate-label window.
 * The real check reads the live value; see assertTimeoutCoversWorker.
 */
describe("timeout budget", () => {
  it("outlives the worker's budget as we last knew it", () => {
    expect(DEFAULT_PRINT_TIMEOUT_MS).toBeGreaterThan(
      FALLBACK_WORKER_RETRY_BUDGET_MS
    );
  });

  it("passes an abort signal on the request", async () => {
    const spy = stubFetch(new Response("{}", { status: 200 }));
    await printZpl({ zpl: "^XA^XZ", printer: "4x6" });
    expect(spy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  // A timeout is NOT the same as an unreachable host: the job was accepted, so
  // a label may exist. Saying "retry" here is how a box gets two labels.
  it("warns that a timed-out print may still have printed", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));
    await expect(printZpl({ zpl: "^XA^XZ", printer: "4x6" })).rejects.toThrow(
      /MAY have printed/
    );
  });

  it("still reports a genuine connect failure as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(printZpl({ zpl: "^XA^XZ", printer: "4x6" })).rejects.toThrow(
      /unreachable/
    );
  });
});

describe("fetchWorkerRetryBudgetMs", () => {
  it("reads the budget the worker publishes on /health", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ status: "ok", retryBudgetMs: 33_600 }), {
        status: 200,
      })
    );
    await expect(fetchWorkerRetryBudgetMs()).resolves.toBe(33_600);
    expect(spy.mock.calls[0][0]).toBe(`${URL_}/health`);
  });

  // /health is unauthenticated by contract; sending the token would leak it to
  // an endpoint that does not need it.
  it("does not send the print token to /health", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ retryBudgetMs: 25_200 }), { status: 200 })
    );
    await fetchWorkerRetryBudgetMs();
    const init = spy.mock.calls[0][1] ?? {};
    expect(JSON.stringify(init)).not.toContain(TOKEN);
  });

  // Older workers return a bare {"status":"ok"} — absence is a supported
  // answer, not a failure.
  it("returns null when the worker publishes no budget", async () => {
    stubFetch(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    await expect(fetchWorkerRetryBudgetMs()).resolves.toBeNull();
  });

  it("returns null rather than throwing when the worker is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(fetchWorkerRetryBudgetMs()).resolves.toBeNull();
  });
});

describe("assertTimeoutCoversWorker", () => {
  /**
   * The case the unit tests cannot catch on their own: the worker raises its
   * own retry count and our default is quietly short again.
   *
   * 99_000 is deliberately synthetic. An earlier version used 33_600 as "the
   * budget if the worker went to 4 attempts", which was wrong — the delays are
   * n-1, not n, so four attempts is 33,800 — and a plausible-looking figure in
   * a test reads as measured to the next person. The subject here is the
   * comparison, not the number, so the number should be obviously invented.
   */
  it("throws when the live budget outgrew our timeout", async () => {
    stubFetch(
      new Response(JSON.stringify({ retryBudgetMs: 99_000 }), { status: 200 })
    );
    await expect(assertTimeoutCoversWorker()).rejects.toThrow(
      /does not cover the worker's retry budget of 99000ms/
    );
  });

  it("passes when our timeout still covers the live budget", async () => {
    stubFetch(
      new Response(JSON.stringify({ retryBudgetMs: 25_200 }), { status: 200 })
    );
    await expect(assertTimeoutCoversWorker()).resolves.toBeUndefined();
  });

  // Failing closed here would ground printing over a missing diagnostic field.
  it("stays silent when the worker publishes no budget", async () => {
    stubFetch(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    await expect(assertTimeoutCoversWorker()).resolves.toBeUndefined();
  });
});

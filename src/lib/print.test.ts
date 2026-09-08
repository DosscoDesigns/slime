import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  printZpl,
  assertPrintWorkerConfigured,
  PrintWorkerError,
  DEFAULT_PRINT_TIMEOUT_MS,
  WORKER_RETRY_BUDGET_MS,
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
 */
describe("timeout budget", () => {
  it("outlives the worker's worst-case retry budget", () => {
    expect(DEFAULT_PRINT_TIMEOUT_MS).toBeGreaterThan(WORKER_RETRY_BUDGET_MS);
  });

  it("pins the worker's budget at 3 attempts of 8s, 600ms apart", () => {
    expect(WORKER_RETRY_BUDGET_MS).toBe(25_200);
  });

  it("passes the default timeout to the request", async () => {
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

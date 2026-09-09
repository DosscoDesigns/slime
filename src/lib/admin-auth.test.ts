import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  passwordOk,
  createSession,
  sessionValid,
  cookieOptions,
  SESSION_TTL_SECONDS,
} from "./admin-auth";

const SECRET = "a".repeat(48);

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
});

afterEach(() => {
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
});

describe("passwordOk", () => {
  it("accepts the configured password", () => {
    expect(passwordOk("correct horse battery staple")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(passwordOk("hunter2")).toBe(false);
  });

  // An unset expected value must never mean "anything is correct" — that is
  // the classic misconfiguration that turns a locked door into an open one.
  it("denies everyone when ADMIN_PASSWORD is unset", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(passwordOk("")).toBe(false);
    expect(passwordOk("anything")).toBe(false);
  });

  it("denies an empty submission", () => {
    expect(passwordOk("")).toBe(false);
    expect(passwordOk(undefined)).toBe(false);
  });
});

describe("sessions", () => {
  it("accepts a freshly minted session", () => {
    expect(sessionValid(createSession())).toBe(true);
  });

  it("rejects a session past its expiry", () => {
    const s = createSession(Date.now());
    const afterExpiry = Date.now() + (SESSION_TTL_SECONDS + 60) * 1000;
    expect(sessionValid(s, afterExpiry)).toBe(false);
  });

  // The whole point of signing: an attacker who writes their own cookie, or
  // extends the expiry on a real one, must not be admitted.
  it("rejects a forged expiry", () => {
    const real = createSession();
    const [, nonce, mac] = real.split(".");
    const forged = `${Date.now() + 999_999_999}.${nonce}.${mac}`;
    expect(sessionValid(forged)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const [exp, nonce] = createSession().split(".");
    expect(sessionValid(`${exp}.${nonce}.${"0".repeat(64)}`)).toBe(false);
  });

  it("rejects a session signed with a different secret", () => {
    const s = createSession();
    process.env.ADMIN_SESSION_SECRET = "b".repeat(48);
    expect(sessionValid(s)).toBe(false);
  });

  it("rejects malformed values without throwing", () => {
    for (const v of ["", "a.b", "a.b.c.d", null, undefined, 42, {}]) {
      expect(sessionValid(v)).toBe(false);
    }
  });

  // A missing or weak secret must deny, not admit, and must not throw into a
  // page render.
  it("denies when the secret is unset", () => {
    const s = createSession();
    delete process.env.ADMIN_SESSION_SECRET;
    expect(sessionValid(s)).toBe(false);
  });

  it("refuses to mint a session on a weak secret", () => {
    process.env.ADMIN_SESSION_SECRET = "tooshort";
    expect(() => createSession()).toThrow(/32 chars/);
  });
});

describe("cookieOptions", () => {
  it("is httpOnly and lax so it cannot be read by script or sent cross-site", () => {
    const o = cookieOptions();
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
  });
});

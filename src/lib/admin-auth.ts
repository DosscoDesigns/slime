/**
 * Admin session auth.
 *
 * SERVER-ONLY. This gates the fulfilment screens, which read every customer's
 * name, address and email and can spend real money buying postage — so it is a
 * genuine access control, not a speed bump.
 *
 * A signed cookie rather than a bearer secret in localStorage: the session
 * value is an HMAC over an expiry, so it cannot be forged without
 * ADMIN_SESSION_SECRET and it dies on its own. There is one shared password
 * because there is one shop with two owners; if this ever needs per-user
 * accounts it needs a real identity provider, not more of this file.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const ADMIN_COOKIE = "slime_admin";

/** Sessions last a working day, so a shift of fulfilment needs one login. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    // Fail closed and loudly. A weak or absent signing key would make every
    // session forgeable, which is worse than the panel being unavailable.
    throw new AdminAuthError(
      "ADMIN_SESSION_SECRET is unset or under 32 chars — refusing to issue admin sessions"
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Check the login password.
 *
 * Compared in constant time, and an unset ADMIN_PASSWORD denies everything
 * rather than admitting everyone — an empty expected value must never mean an
 * empty submitted value is correct.
 */
export function passwordOk(submitted: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length === 0) return false;
  if (typeof submitted !== "string" || submitted.length === 0) return false;
  return safeEqual(submitted, expected);
}

/** Mint a session value: `<expiresAtMs>.<nonce>.<hmac>`. */
export function createSession(now: number = Date.now()): string {
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Is this cookie value a live, untampered session?
 *
 * Signature is verified BEFORE the expiry is read, so an attacker cannot get a
 * forged expiry taken seriously even for the moment it takes to compare it.
 */
export function sessionValid(value: unknown, now: number = Date.now()): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [expiresAtRaw, nonce, mac] = parts;
  const payload = `${expiresAtRaw}.${nonce}`;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // No secret configured — deny rather than throw into a render.
    return false;
  }
  if (!safeEqual(mac, expected)) return false;

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/** Cookie attributes. Secure is dropped in dev so localhost login works. */
export function cookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

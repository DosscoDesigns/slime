import { describe, it, expect } from "vitest";
import { detectCarrier, trackUrl, isCarrier, CARRIERS } from "./carriers";

/**
 * These moved out of order-email.ts when the admin portal started needing the
 * same links. The point of one table is that the link a customer gets in the
 * shipping notice and the link an operator clicks in the portal are the same
 * link — so these pin the shared behaviour, not the email's use of it.
 */

describe("detectCarrier", () => {
  it("recognises the three carriers we actually ship with", () => {
    expect(detectCarrier("1Z999AA10123456784")).toBe("ups");
    expect(detectCarrier("9205590164917312751089")).toBe("usps");
    expect(detectCarrier("123456789012")).toBe("fedex");
    expect(detectCarrier("123456789012345")).toBe("fedex");
  });

  it("tolerates spacing and case in a number someone pasted", () => {
    expect(detectCarrier(" 1z999aa1 0123456784 ")).toBe("ups");
  });

  /** A wrong-but-plausible link beats no link; callers who know should pass it. */
  it("falls back to USPS rather than refusing to guess", () => {
    expect(detectCarrier("wat")).toBe("usps");
    expect(detectCarrier("")).toBe("usps");
  });
});

describe("trackUrl", () => {
  it("builds the carrier's own tracking page", () => {
    expect(trackUrl("9205590164917312751089")).toContain("tools.usps.com");
    expect(trackUrl("1Z999AA10123456784")).toContain("ups.com");
    expect(trackUrl("123456789012", "fedex")).toContain("fedex.com");
  });

  it("honours an explicit carrier over the shape guess", () => {
    // A FedEx-shaped number that is really UPS.
    expect(trackUrl("123456789012", "ups")).toContain("ups.com");
  });

  it("escapes the number rather than pasting it into a URL raw", () => {
    expect(trackUrl("a b&c=d", "usps")).toContain("a%20b%26c%3Dd");
  });
});

describe("isCarrier", () => {
  /** Guards a value read back out of Stripe metadata, which is just a string. */
  it("only admits carriers the table knows", () => {
    expect(isCarrier("usps")).toBe(true);
    expect(isCarrier("dhl")).toBe(false);
    expect(isCarrier(null)).toBe(false);
    expect(isCarrier(undefined)).toBe(false);
    expect(Object.keys(CARRIERS)).toEqual(["usps", "ups", "fedex"]);
  });
});

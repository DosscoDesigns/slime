import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/amazon-inventory", () => ({ accessToken: vi.fn(), SP_API: "", MARKETPLACE_US: "US" }));
import { ownerFixes, planName } from "./amazon-inbound";

describe("ownerFixes", () => {
  it("reads the accepted owner out of Amazon's error", () => {
    expect(
      ownerFixes(
        "Amazon 400: ERROR: HP-IQWX-RCGQ does not require prepOwner but SELLER was assigned. Accepted values: [NONE]"
      )
    ).toEqual([{ msku: "HP-IQWX-RCGQ", field: "prepOwner", value: "NONE" }]);
  });

  it("finds nothing in an unrelated error", () => {
    expect(ownerFixes("Amazon 400: invalid address")).toEqual([]);
  });
});

describe("planName", () => {
  it("names the plan after the packing run so status can be found again", () => {
    expect(planName(12, "2026-11-20")).toBe("Slime pack #12 (2026-11-20)");
  });
});

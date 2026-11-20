import { describe, it, expect } from "vitest";
import { fbaLabelZpl } from "./fba-label-zpl";

const base = {
  fnsku: "X0055YOG1L",
  title: "The Slime Co Instant Slime Powder (RYGB Multi, 20 Gallons)",
  lotCode: "MP-261120-03",
  copies: 4,
};

describe("fbaLabelZpl", () => {
  it("sizes the label 2.25x1.25 in at 203 dpi and prints the count asked", () => {
    const z = fbaLabelZpl(base);
    expect(z).toMatch(/\^PW457\n\^LL254/);
    expect(z).toContain("^MNW"); // gap sensing, so labels don't drift
    expect(z).toContain("^MTD");
    expect(z).toContain("^PQ4,0,1,N");
    expect(z.match(/\^BC/g)).toHaveLength(1); // the FNSKU is the only barcode
    expect(z).toContain("^FDX0055YOG1L^FS");
    expect(z).toContain("^FDLot MP-261120-03^FS");
  });

  it("shifts the whole label down when asked, and refuses an out-of-range shift", () => {
    expect(fbaLabelZpl(base)).toContain("^LT0");
    expect(fbaLabelZpl({ ...base, shiftDown: 30 })).toContain("^LT30");
    expect(() => fbaLabelZpl({ ...base, shiftDown: 121 })).toThrow();
    expect(() => fbaLabelZpl({ ...base, shiftDown: 2.5 })).toThrow();
  });

  it("strips ZPL control characters from the title", () => {
    const z = fbaLabelZpl({ ...base, title: "Bad ^XZ title ~JR" });
    expect(z).toContain("^FDBad XZ title JR^FS");
  });

  it("rejects a bad FNSKU, lot or count", () => {
    expect(() => fbaLabelZpl({ ...base, fnsku: "x" })).toThrow();
    expect(() => fbaLabelZpl({ ...base, lotCode: "^XZ" })).toThrow();
    expect(() => fbaLabelZpl({ ...base, copies: 0 })).toThrow();
    expect(() => fbaLabelZpl({ ...base, copies: 501 })).toThrow();
  });
});

/**
 * FBA item label content. SERVER-ONLY (bwip-js renders the barcode here so
 * the browser just prints an SVG).
 *
 * Amazon's item label: the FNSKU as a Code 128 barcode with the FNSKU printed
 * under it, the product title, and the condition. Size 1"×2" up to 2"×3"; we
 * print on DYMO 30334 (2¼"×1¼"). The pack lot is added as plain text — the
 * FNSKU must stay the only barcode on the label.
 */
import bwipjs from "bwip-js/node";

export const LABEL_WIDTH_IN = 2.25;
export const LABEL_HEIGHT_IN = 1.25;

export function fnskuBarcodeSvg(fnsku: string): string {
  if (!/^[A-Z0-9]{10}$/.test(fnsku)) throw new Error(`not an FNSKU: ${fnsku}`);
  return bwipjs.toSVG({
    bcid: "code128",
    text: fnsku,
    height: 9,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
}

/** Amazon allows the title to be shortened to fit; keep both ends readable. */
export function labelTitle(title: string, max = 60): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}

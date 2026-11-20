/**
 * FBA item label as ZPL, for the Zebra GX420d (203 dpi) behind the DD print
 * worker. Pure — no I/O. Same content and size as the browser label: a
 * 2¼"×1¼" label with the FNSKU as the only barcode (Code 128, drawn by the
 * printer so the bars land on whole dots), FNSKU text, title, "New", and
 * the lot code as plain text.
 */

const DPI = 203;
const W = Math.round(2.25 * DPI); // 457 dots
const H = Math.round(1.25 * DPI); // 254 dots
const MODULE = 2; // dots per narrow bar

/** ZPL treats ^ and ~ as commands; strip them and anything non-printable. */
const clean = (s: string) => s.replace(/[\^~]/g, "").replace(/[^\x20-\x7E]/g, "");

/** Code 128 B width in modules: start + data + check (11 each) + stop (13). */
const code128Modules = (data: string) => 11 * (data.length + 2) + 13;

export function fbaLabelZpl({
  fnsku,
  title,
  lotCode,
  copies,
  shiftDown = 0,
}: {
  fnsku: string;
  title: string;
  lotCode: string;
  copies: number;
  /**
   * Dots to move the whole label down (^LT), -120..120 (203 dots = 1 inch).
   * Printers start printing a little above or below the label edge; this
   * lines it up without changing the layout.
   */
  shiftDown?: number;
}): string {
  if (!/^[A-Z0-9]{10}$/.test(fnsku)) throw new Error(`not an FNSKU: ${fnsku}`);
  if (!/^[A-Z0-9-]{6,24}$/.test(lotCode)) throw new Error(`not a lot code: ${lotCode}`);
  if (!Number.isInteger(copies) || copies < 1 || copies > 500) {
    throw new Error(`label count must be 1–500, got ${copies}`);
  }
  if (!Number.isInteger(shiftDown) || shiftDown < -120 || shiftDown > 120) {
    throw new Error(`label shift must be a whole number from -120 to 120 dots, got ${shiftDown}`);
  }
  const barX = Math.max(0, Math.round((W - code128Modules(fnsku) * MODULE) / 2));
  const t = clean(title);
  const shortTitle = t.length <= 64 ? t : `${t.slice(0, 61).trimEnd()}...`;
  return [
    "^XA",
    "^CI0",
    // Find each label by the gap between labels, and print direct thermal (no
    // ribbon). Without ^MNW a printer left in continuous mode drifts a little
    // more on every label until the barcode runs off the edge.
    "^MNW",
    "^MTD",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    `^LT${shiftDown}`,
    `^FO${barX},24^BY${MODULE},3,70^BCN,70,N,N,N^FD${fnsku}^FS`,
    `^FO0,100^FB${W},1,0,C^A0N,24,24^FD${fnsku}^FS`,
    `^FO20,130^FB${W - 40},2,2,L^A0N,20,20^FD${shortTitle}^FS`,
    `^FO20,206^A0N,22,22^FDNew^FS`,
    `^FO20,206^FB${W - 40},1,0,R^A0N,22,22^FDLot ${clean(lotCode)}^FS`,
    `^PQ${copies},0,1,N`,
    "^XZ",
  ].join("\n");
}

import type Stripe from "stripe";

interface RenderArgs {
  pi: Stripe.PaymentIntent;
  charge: Stripe.Charge | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

interface CartLine {
  n: string; // name
  q: number; // quantity
  c: number; // unit price (cents)
}

function parseLines(metadata: Stripe.Metadata | null): CartLine[] {
  try {
    const parsed = JSON.parse(metadata?.items || "[]") as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function money(cents: number | null | undefined): string {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function addressLines(
  addr: Stripe.Address | null | undefined,
  name?: string | null
): string[] {
  if (!addr) return ["(not provided)"];
  const cityLine = [addr.city, addr.state, addr.postal_code]
    .filter(Boolean)
    .join(", ");
  return [
    name ?? undefined,
    addr.line1 ?? undefined,
    addr.line2 ?? undefined,
    cityLine || undefined,
    addr.country ?? undefined,
  ].filter((v): v is string => Boolean(v));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const LIME = "#84cc16"; // slightly darker than site lime for white-bg contrast
const INK = "#0a0a0a";

export function renderOrderEmail({ pi, charge }: RenderArgs): RenderedEmail {
  const lines = parseLines(pi.metadata);
  const subtotal = Number(pi.metadata.subtotal_cents || 0);
  const shipping = Number(pi.metadata.shipping_cents || 0);
  const tax = Number(pi.metadata.tax_cents || 0);
  const total = pi.amount;
  const totalItems = lines.reduce((s, l) => s + l.q, 0);

  const customerName =
    charge?.shipping?.name ?? charge?.billing_details?.name ?? "(unknown)";
  const customerEmail =
    charge?.receipt_email ?? charge?.billing_details?.email ?? "(unknown)";
  const customerPhone =
    charge?.billing_details?.phone ?? charge?.shipping?.phone ?? "";
  const shippingAddr = charge?.shipping?.address ?? charge?.billing_details?.address;
  const shippingName = charge?.shipping?.name ?? customerName;
  const receiptUrl = charge?.receipt_url ?? "";

  const subject = `Order confirmed — ${customerName} · ${totalItems} ${
    totalItems === 1 ? "item" : "items"
  } · ${money(total)}`;

  /* ─── Plain-text ─── */
  const t: string[] = [];
  t.push("THE SLIME CO — Order confirmed");
  t.push("");
  t.push(`${customerName} · ${totalItems} ${totalItems === 1 ? "item" : "items"} · ${money(total)}`);
  t.push("");
  t.push("ORDER");
  for (const l of lines) {
    t.push(`  ${l.n} x${l.q} @ ${money(l.c)} ea = ${money(l.c * l.q)}`);
  }
  t.push("");
  t.push(`  Subtotal:  ${money(subtotal)}`);
  t.push(`  Shipping:  ${shipping === 0 ? "Free" : money(shipping)}`);
  if (tax > 0) t.push(`  FL sales tax (7.5%): ${money(tax)}`);
  t.push(`  Total:     ${money(total)}`);
  t.push("");
  t.push("SHIP TO");
  for (const ln of addressLines(shippingAddr, shippingName)) t.push(`  ${ln}`);
  t.push("");
  t.push("CUSTOMER");
  t.push(`  ${customerName}`);
  t.push(`  ${customerEmail}`);
  if (customerPhone) t.push(`  ${customerPhone}`);
  t.push("");
  if (receiptUrl) t.push(`Stripe receipt: ${receiptUrl}`);
  t.push(`Order reference: ${pi.id}`);
  const text = t.join("\n");

  /* ─── HTML ─── */
  const lineRows = lines
    .map(
      (l) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-family:${SANS};color:${INK};font-size:14px;">
                <strong style="font-weight:600;">${escapeHtml(l.n)}</strong> × ${l.q}
                <span style="color:#777;font-size:13px;"> &nbsp;@ ${money(l.c)} ea</span>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-family:${SANS};color:${INK};font-size:14px;text-align:right;white-space:nowrap;">
                ${money(l.c * l.q)}
              </td>
            </tr>`
    )
    .join("");

  const shippingHtml = addressLines(shippingAddr, shippingName)
    .map(escapeHtml)
    .join("<br>");
  const taxRow =
    tax > 0
      ? `<tr>
              <td style="padding:4px 0;font-family:${SANS};color:#555;font-size:14px;">FL sales tax (7.5%)</td>
              <td style="padding:4px 0;font-family:${SANS};color:#555;font-size:14px;text-align:right;">${money(tax)}</td>
            </tr>`
      : "";
  const receiptBtn = receiptUrl
    ? `<tr><td style="padding:24px 32px 4px 32px;text-align:center;">
          <a href="${escapeHtml(receiptUrl)}" style="display:inline-block;padding:12px 28px;background-color:${LIME};color:${INK};text-decoration:none;font-family:${SANS};font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;border-radius:999px;">View receipt</a>
        </td></tr>`
    : "";
  const phoneHtml = customerPhone ? `<br>${escapeHtml(customerPhone)}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${SANS};color:${INK};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="background-color:${INK};padding:32px;text-align:center;">
            <div style="font-family:${SANS};font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">THE SLIME <span style="color:${LIME};">CO</span></div>
            <div style="font-family:${SANS};font-size:13px;color:#a1a1aa;margin-top:6px;letter-spacing:0.18em;text-transform:uppercase;">Order Confirmed</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0 32px;text-align:center;">
            <div style="font-family:${SANS};font-size:15px;color:#555;">
              ${escapeHtml(customerName)} &middot; ${totalItems} ${totalItems === 1 ? "item" : "items"} &middot; <strong style="color:${INK};">${money(total)}</strong>
            </div>
          </td>
        </tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Order</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eee;">
            ${lineRows}
            <tr>
              <td style="padding:12px 0 4px 0;font-family:${SANS};color:#555;font-size:14px;">Subtotal</td>
              <td style="padding:12px 0 4px 0;font-family:${SANS};color:#555;font-size:14px;text-align:right;">${money(subtotal)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:${SANS};color:#555;font-size:14px;">Shipping</td>
              <td style="padding:4px 0;font-family:${SANS};color:#555;font-size:14px;text-align:right;">${shipping === 0 ? "Free" : money(shipping)}</td>
            </tr>
            ${taxRow}
            <tr>
              <td style="padding:14px 0 4px 0;border-top:2px solid #eee;font-family:${SANS};color:${INK};font-size:18px;font-weight:700;">Total</td>
              <td style="padding:14px 0 4px 0;border-top:2px solid #eee;font-family:${SANS};color:${INK};font-size:18px;font-weight:700;text-align:right;">${money(total)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Ship to</div>
          <div style="font-family:${SANS};color:${INK};font-size:14px;line-height:1.6;">${shippingHtml}</div>
        </td></tr>
        <tr><td style="padding:20px 32px 0 32px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Customer</div>
          <div style="font-family:${SANS};color:${INK};font-size:14px;line-height:1.6;">
            <strong>${escapeHtml(customerName)}</strong><br>
            <a href="mailto:${escapeHtml(customerEmail)}" style="color:#0a0a0a;text-decoration:underline;">${escapeHtml(customerEmail)}</a>${phoneHtml}
          </div>
        </td></tr>
        ${receiptBtn}
        <tr><td style="padding:24px 32px 32px 32px;text-align:center;font-family:${SANS};font-size:11px;color:#999;">
          Order reference: <span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(pi.id)}</span>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;margin-top:12px;">
        <tr><td style="text-align:center;font-family:${SANS};font-size:11px;color:#999;padding:16px;">
          The Slime Co &middot; Thanks for ordering — it's about to get messy.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

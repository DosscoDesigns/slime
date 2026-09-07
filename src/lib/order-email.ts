import type Stripe from "stripe";
import { CONTACT_EMAIL } from "@/lib/site";

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

/**
 * The OPS notice — the fulfillment ticket sent to the owners.
 *
 * Deliberately owner-shaped: it recites the buyer's contact details back for
 * order handling, and leads with the customer name so a full inbox reads as a
 * queue. The customer never receives this; they get renderCustomerReceipt().
 */
export function renderOpsNotice({ pi, charge }: RenderArgs): RenderedEmail {
  const lines = parseLines(pi.metadata);
  const subtotal = Number(pi.metadata.subtotal_cents || 0);
  const discount = Number(pi.metadata.discount_cents || 0);
  const couponCode = pi.metadata.coupon_code || "";
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

  const subject = `New order — ${customerName} · ${totalItems} ${
    totalItems === 1 ? "item" : "items"
  } · ${money(total)}`;

  /* ─── Plain-text ─── */
  const t: string[] = [];
  t.push("THE SLIME CO — New order");
  t.push("");
  t.push(`${customerName} · ${totalItems} ${totalItems === 1 ? "item" : "items"} · ${money(total)}`);
  t.push("");
  t.push("ORDER");
  for (const l of lines) {
    t.push(`  ${l.n} x${l.q} @ ${money(l.c)} ea = ${money(l.c * l.q)}`);
  }
  t.push("");
  t.push(`  Subtotal:  ${money(subtotal)}`);
  if (discount > 0) {
    t.push(`  Discount${couponCode ? ` (${couponCode})` : ""}: -${money(discount)}`);
  }
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
            <div style="font-family:${SANS};font-size:13px;color:#a1a1aa;margin-top:6px;letter-spacing:0.18em;text-transform:uppercase;">New Order</div>
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
            ${
              discount > 0
                ? `<tr>
              <td style="padding:4px 0;font-family:${SANS};color:#166534;font-size:14px;">Discount${couponCode ? ` (${escapeHtml(couponCode)})` : ""}</td>
              <td style="padding:4px 0;font-family:${SANS};color:#166534;font-size:14px;text-align:right;">-${money(discount)}</td>
            </tr>`
                : ""
            }
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
          The Slime Co &middot; Internal order notice.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * The CUSTOMER receipt.
 *
 * Written for the buyer, not the shop: it thanks them, shows what they bought
 * and what it cost, tells them what happens next, and points them at a real
 * address they can reply to. It deliberately omits the "Customer" block from
 * the ops notice — reciting someone's own name, email and phone back at them
 * reads as an internal record, not a receipt.
 *
 * This is the only order mail the buyer receives. Stripe's automatic receipt
 * is suppressed (we never set receipt_email) so the two can't compete, which
 * makes this email the transaction record — don't reduce it to a teaser.
 */
export function renderCustomerReceipt({ pi, charge }: RenderArgs): RenderedEmail {
  const lines = parseLines(pi.metadata);
  const subtotal = Number(pi.metadata.subtotal_cents || 0);
  const discount = Number(pi.metadata.discount_cents || 0);
  const couponCode = pi.metadata.coupon_code || "";
  const shipping = Number(pi.metadata.shipping_cents || 0);
  const tax = Number(pi.metadata.tax_cents || 0);
  const total = pi.amount;
  const totalItems = lines.reduce((s, l) => s + l.q, 0);

  const firstName = (
    charge?.shipping?.name ??
    charge?.billing_details?.name ??
    ""
  )
    .trim()
    .split(/\s+/)[0];
  const shippingAddr = charge?.shipping?.address ?? charge?.billing_details?.address;
  const shippingName = charge?.shipping?.name ?? charge?.billing_details?.name ?? "";
  const receiptUrl = charge?.receipt_url ?? "";

  const subject = `Your Slime Co order is confirmed · ${money(total)}`;

  /* ─── Plain-text ─── */
  const t: string[] = [];
  t.push(`Thanks${firstName ? `, ${firstName}` : ""} — your order is confirmed.`);
  t.push("");
  t.push("We're packing it now. You'll get a shipping note with tracking as");
  t.push("soon as it's on its way.");
  t.push("");
  t.push("YOUR ORDER");
  for (const l of lines) {
    t.push(`  ${l.n} x${l.q} @ ${money(l.c)} ea = ${money(l.c * l.q)}`);
  }
  t.push("");
  t.push(`  Subtotal:  ${money(subtotal)}`);
  if (discount > 0) {
    t.push(`  Discount${couponCode ? ` (${couponCode})` : ""}: -${money(discount)}`);
  }
  t.push(`  Shipping:  ${shipping === 0 ? "Free" : money(shipping)}`);
  if (tax > 0) t.push(`  FL sales tax (7.5%): ${money(tax)}`);
  t.push(`  Total:     ${money(total)}`);
  t.push("");
  t.push("SHIPPING TO");
  for (const ln of addressLines(shippingAddr, shippingName)) t.push(`  ${ln}`);
  t.push("");
  t.push("JUST ADD WATER");
  t.push("  Dump the powder in a bucket, add water, stir. That's it —");
  t.push("  full instructions are in the box.");
  t.push("");
  if (receiptUrl) t.push(`Receipt: ${receiptUrl}`);
  t.push(`Order reference: ${pi.id}`);
  t.push("");
  t.push(`Questions? Just reply to this email, or write to ${CONTACT_EMAIL}.`);
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
            <div style="font-family:${SANS};font-size:20px;font-weight:700;color:${INK};">Thanks${firstName ? `, ${escapeHtml(firstName)}` : ""} — you're all set.</div>
            <div style="font-family:${SANS};font-size:14px;color:#555;margin-top:8px;line-height:1.6;">
              We're packing your order now. You'll get a shipping note with tracking as soon as it's on its way.
            </div>
          </td>
        </tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Your order</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eee;">
            ${lineRows}
            <tr>
              <td style="padding:12px 0 4px 0;font-family:${SANS};color:#555;font-size:14px;">Subtotal</td>
              <td style="padding:12px 0 4px 0;font-family:${SANS};color:#555;font-size:14px;text-align:right;">${money(subtotal)}</td>
            </tr>
            ${
              discount > 0
                ? `<tr>
              <td style="padding:4px 0;font-family:${SANS};color:#166534;font-size:14px;">Discount${couponCode ? ` (${escapeHtml(couponCode)})` : ""}</td>
              <td style="padding:4px 0;font-family:${SANS};color:#166534;font-size:14px;text-align:right;">-${money(discount)}</td>
            </tr>`
                : ""
            }
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
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Shipping to</div>
          <div style="font-family:${SANS};color:${INK};font-size:14px;line-height:1.6;">${shippingHtml}</div>
        </td></tr>
        <tr><td style="padding:24px 32px 0 32px;">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${LIME};font-weight:700;margin-bottom:8px;">Just add water</div>
          <div style="font-family:${SANS};color:#555;font-size:14px;line-height:1.6;">
            Dump the powder in a bucket, add water, stir. That's it — full instructions are in the box.
          </div>
        </td></tr>
        ${receiptBtn}
        <tr><td style="padding:24px 32px 8px 32px;text-align:center;font-family:${SANS};font-size:11px;color:#999;">
          Order reference: <span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(pi.id)}</span>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;text-align:center;font-family:${SANS};font-size:13px;color:#555;">
          Questions? Just reply to this email, or write to
          <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:${INK};text-decoration:underline;">${escapeHtml(CONTACT_EMAIL)}</a>.
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

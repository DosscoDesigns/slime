/**
 * One-off shipping-notice sender.
 *
 * Renders renderShippingNotice() against a REAL live PaymentIntent and either
 * writes a preview file (default) or sends it via Mailgun and records the
 * tracking number back onto the PI (--send).
 *
 * Usage:
 *   node scripts/send-shipping-notice.mjs <pi_id> <tracking> [--send]
 *
 * Secrets come from 1Password at run time; nothing is written to disk.
 * Lives in TEMP/ (gitignored) — this is scaffolding until the admin panel
 * owns this flow.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

// Resolve the repo's "@/..." alias the same way vitest.config.ts does, so this
// script can import application code directly instead of duplicating it.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        url: pathToFileURL(path.join(SRC, `${specifier.slice(2)}.ts`)).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { renderShippingNotice, detectCarrier } = await import(
  "../src/lib/order-email.ts"
);

const [piId, tracking, ...flags] = process.argv.slice(2);
if (!piId || !tracking) {
  console.error("usage: node scripts/send-shipping-notice.mjs <pi_id> <tracking> [--send]");
  process.exit(1);
}
const doSend = flags.includes("--send");

const op = (ref) => execFileSync("op", ["read", ref], { encoding: "utf8" }).trim();

const stripeKey = op("op://DEV/dd.stripe.slime/secret_key");

async function stripeGet(pathname) {
  const res = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(`Stripe: ${json.error.message}`);
  return json;
}

const pi = await stripeGet(`payment_intents/${piId}`);
const charges = await stripeGet(`charges?payment_intent=${piId}&limit=1`);
const charge = charges.data[0] ?? null;

const carrier = detectCarrier(tracking);
const mail = renderShippingNotice({ pi, charge, tracking });
const to = pi.receipt_email ?? charge?.receipt_email ?? charge?.billing_details?.email;

console.log("── Shipping notice ──");
console.log("PI:       ", pi.id, `(${pi.status})`);
console.log("To:       ", to);
console.log("Name:     ", charge?.shipping?.name ?? charge?.billing_details?.name);
console.log("Carrier:  ", carrier, tracking);
console.log("Subject:  ", mail.subject);
console.log("Already sent at:", pi.metadata.shipping_email_sent_at ?? "(never)");
console.log("");

if (!doSend) {
  const out = path.join(fileURLToPath(new URL(".", import.meta.url)), "shipping-notice-preview.html");
  fs.writeFileSync(out, mail.html);
  console.log("DRY RUN — nothing sent. Preview written to:");
  console.log(" ", out);
  console.log("\n--- plain text ---\n");
  console.log(mail.text);
  process.exit(0);
}

if (!to) throw new Error("no customer email on this order — refusing to send");
if (pi.metadata.shipping_email_sent_at) {
  throw new Error(
    `shipping notice already sent at ${pi.metadata.shipping_email_sent_at} — refusing to double-send`
  );
}

const mgKey = op("op://DEV/dd.mailgun.slime/api_key");
const mgDomain = op("op://DEV/dd.mailgun.slime/domain");
const mgFrom = op("op://DEV/dd.mailgun.slime/from_email");

const form = new URLSearchParams();
form.set("from", mgFrom);
form.set("h:Reply-To", "info@theslimecompany.com");
form.set("to", to);
form.set("subject", mail.subject);
form.set("text", mail.text);
form.set("html", mail.html);

const res = await fetch(`https://api.mailgun.net/v3/${mgDomain}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`api:${mgKey}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: form.toString(),
});
if (!res.ok) throw new Error(`Mailgun ${res.status}: ${await res.text()}`);
console.log("SENT:", JSON.stringify(await res.json()));

// Record it on the PI so the order carries its own tracking number and a
// second run can't double-send.
const upd = new URLSearchParams();
upd.set("metadata[tracking_number]", tracking);
upd.set("metadata[tracking_carrier]", carrier);
upd.set("metadata[shipping_email_sent_at]", new Date().toISOString());
const updRes = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: upd.toString(),
});
const updJson = await updRes.json();
if (updJson.error) console.warn("WARN: could not flag PI:", updJson.error.message);
else console.log("PI flagged with tracking + shipping_email_sent_at");

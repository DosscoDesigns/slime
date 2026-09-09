/**
 * Fulfilment routine for one order: quote -> buy label -> print -> email.
 *
 * Dimensions and weight are typed in by hand, deliberately. We do not yet know
 * the real shipped weight of each kit tier, and guessing them into a table
 * would bake a wrong number into pricing. Measure the box, pass the numbers.
 * When the tiers settle, this becomes a lookup and the admin panel takes over.
 *
 *   node scripts/ship-order.mjs <pi_id> --dims 12x10x8 --weight 3.4
 *       ...quote only. Always start here.
 *   node scripts/ship-order.mjs <pi_id> --dims 12x10x8 --weight 3.4 --buy --print --email
 *       ...buy the cheapest rate, print it, and tell the customer.
 *
 * Flags are separate on purpose: --buy spends money, --print moves paper, and
 * --email is outbound to a customer. Each is a decision, none is implied.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
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

const shipping = await import("../src/lib/shipping.ts");
const { renderShippingNotice } = await import("../src/lib/order-email.ts");
const { printZpl, assertTimeoutCoversWorker } = await import("../src/lib/print.ts");

/* ── config ──
 * .env.local holds the ship-from address and may carry `op://` references
 * instead of literal secrets, so nothing sensitive sits on disk in plaintext.
 * Anything shaped like an op:// ref is resolved through the 1Password CLI at
 * run time; literals are taken as-is.
 */
const op = (ref) => execFileSync("op", ["read", ref], { encoding: "utf8" }).trim();

const envLocal = path.join(fileURLToPath(new URL("..", import.meta.url)), ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k]) continue;
    const v = raw.trim().replace(/^["']|["']$/g, "");
    process.env[k] = v.startsWith("op://") ? op(v) : v;
  }
}

process.env.SHIPPO_API_KEY ||= op("op://DEV/dd.shippo.slime/credential");
const stripeKey = op("op://DEV/dd.stripe.slime/secret_key");

/* ── args ── */
const argv = process.argv.slice(2);
const piId = argv[0];
const flag = (n) => argv.includes(`--${n}`);
const val = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? undefined : argv[i + 1];
};

const dims = val("dims");
const weight = Number(val("weight"));
if (!piId || !dims || !weight) {
  console.error(
    "usage: node scripts/ship-order.mjs <pi_id> --dims LxWxH --weight LB [--buy] [--print] [--email]"
  );
  process.exit(1);
}
const [lengthIn, widthIn, heightIn] = dims.split("x").map(Number);
if (![lengthIn, widthIn, heightIn].every((n) => n > 0)) {
  console.error(`--dims must look like 12x10x8, got "${dims}"`);
  process.exit(1);
}
const parcel = { lengthIn, widthIn, heightIn, weightLb: weight };

const money = (c) => `$${(c / 100).toFixed(2)}`;

/* ── order ── */
const auth = `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}`;
const sget = async (p) => {
  const r = await fetch(`https://api.stripe.com/v1/${p}`, { headers: { Authorization: auth } });
  const j = await r.json();
  if (j.error) throw new Error(`Stripe: ${j.error.message}`);
  return j;
};

const pi = await sget(`payment_intents/${piId}`);
const charge = (await sget(`charges?payment_intent=${piId}&limit=1`)).data[0] ?? null;
const ship = charge?.shipping ?? null;
if (!ship?.address) throw new Error("no shipping address on this order");

const to = {
  name: ship.name,
  street1: ship.address.line1,
  street2: ship.address.line2 || undefined,
  city: ship.address.city,
  state: ship.address.state,
  zip: ship.address.postal_code,
  country: ship.address.country || "US",
  email: charge?.billing_details?.email ?? undefined,
  phone: ship.phone || charge?.billing_details?.phone || undefined,
};

console.log(`\n── ${ship.name} · ${money(pi.amount)} · ${pi.id}`);
for (const l of JSON.parse(pi.metadata.items || "[]")) console.log(`   ${l.n} x${l.q}`);
console.log(`   ${to.street1}, ${to.city}, ${to.state} ${to.zip}`);
if (pi.metadata.tracking_number) {
  console.log(`\n!! already has tracking ${pi.metadata.tracking_number} — shipped on ${pi.metadata.shipping_email_sent_at}`);
}

/* ── parcel sanity ── */
const cuft = shipping.parcelCubicFeet(parcel);
console.log(`\n── parcel ${lengthIn}x${widthIn}x${heightIn} in, ${weight} lb  (${cuft.toFixed(2)} cu ft)`);
if (shipping.exceedsDimWeightThreshold(parcel)) {
  console.log(
    `   !! OVER ${shipping.DIM_WEIGHT_THRESHOLD_CU_FT} cu ft — USPS bills dimensional weight above this.\n` +
      `      Measured FL->PA at 3 lb: 0.56 cu ft = $6.99, 1.11 cu ft = $16.87. Repack smaller if you can.`
  );
}
if (shipping.isTestMode()) console.log("   (Shippo TEST key — no real postage)");

/* ── rates ── */
const { rates, messages } = await shipping.getRates(to, parcel);
console.log(`\n── rates`);
for (const r of rates) {
  console.log(`   ${r.serviceToken === rates[0].serviceToken ? "→" : " "} ${r.provider} ${r.service.padEnd(24)} ${money(r.amountCents).padStart(8)}  ${r.estimatedDays ?? "?"}d`);
}
const charged = Number(pi.metadata.shipping_cents || 0);
const best = rates[0];
console.log(`\n   customer paid ${money(charged)} shipping · cheapest is ${money(best.amountCents)} · margin ${money(charged - best.amountCents)}`);
const noise = messages.filter((m) => m.text).length;
if (noise) console.log(`   (${noise} carrier messages suppressed — normal, mostly carriers we don't use)`);

if (!flag("buy")) {
  console.log(`\nQUOTE ONLY — nothing bought. Add --buy to purchase ${best.service}.\n`);
  process.exit(0);
}

/* ── buy ── */
const label = await shipping.buyLabel(best.id);
console.log(`\n── bought ${label.provider} ${label.service} for ${money(label.amountCents)}`);
console.log(`   tracking ${label.trackingNumber}`);

/* ── print ── */
if (flag("print")) {
  await assertTimeoutCoversWorker();
  const zpl = await shipping.fetchLabelZpl(label.labelUrl);
  await printZpl({ zpl, printer: "4x6" });
  console.log(`   printed to Zebra 4x6 (${zpl.length} bytes ZPL)`);
} else {
  console.log(`   label NOT printed (no --print). ZPL: ${label.labelUrl}`);
}

/* ── record on the order before emailing, so a crash can't lose the tracking ── */
const upd = new URLSearchParams();
upd.set("metadata[tracking_number]", label.trackingNumber);
upd.set("metadata[tracking_carrier]", "usps");
upd.set("metadata[shipping_cost_cents]", String(label.amountCents));
await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
  body: upd.toString(),
});
console.log(`   recorded on the PaymentIntent`);

/* ── email ── */
if (!flag("email")) {
  console.log(`\nCustomer NOT emailed (no --email).\n`);
  process.exit(0);
}
if (pi.metadata.shipping_email_sent_at) {
  console.log(`\nCustomer already emailed at ${pi.metadata.shipping_email_sent_at} — refusing to double-send.\n`);
  process.exit(0);
}

const mail = renderShippingNotice({ pi, charge, tracking: label.trackingNumber });
const form = new URLSearchParams();
form.set("from", op("op://DEV/dd.mailgun.slime/from_email"));
form.set("h:Reply-To", "info@theslimecompany.com");
form.set("to", to.email);
form.set("subject", mail.subject);
form.set("text", mail.text);
form.set("html", mail.html);
const mg = await fetch(
  `https://api.mailgun.net/v3/${op("op://DEV/dd.mailgun.slime/domain")}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${op("op://DEV/dd.mailgun.slime/api_key")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  }
);
if (!mg.ok) throw new Error(`Mailgun ${mg.status}: ${await mg.text()}`);
const stamp = new URLSearchParams();
stamp.set("metadata[shipping_email_sent_at]", new Date().toISOString());
await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
  body: stamp.toString(),
});
console.log(`   emailed ${to.email}\n`);

// Minimal Mailgun sender (HTTP API, no SDK). Ported from rkpm — reads
// process.env directly instead of a dedicated env module.

import { CONTACT_EMAIL } from "@/lib/site";

// No bcc. Order mail goes out as two separate messages (ops notice, customer
// receipt) precisely because a BCC'd send gives every recipient the same
// Message-ID, which mail clients dedupe — an owner who is also the buyer sees
// one copy, and the customer receives the shop's internal ticket. Don't add
// it back for that purpose.
interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function assertMailgunConfigured(): void {
  if (
    !process.env.MAILGUN_API_KEY ||
    !process.env.MAILGUN_DOMAIN ||
    !process.env.MAILGUN_FROM
  ) {
    throw new Error(
      "Mailgun is not configured (need MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM)"
    );
  }
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}: SendMailParams): Promise<{ id: string; message: string }> {
  assertMailgunConfigured();

  const form = new URLSearchParams();
  form.set("from", process.env.MAILGUN_FROM!);
  // MAILGUN_FROM is on the mg.* sending subdomain, which is DNS-verified for
  // sending only — it does not receive. Without this header a customer hitting
  // reply on their order confirmation mails into a black hole.
  form.set("h:Reply-To", CONTACT_EMAIL);
  form.set("to", to);
  form.set("subject", subject);
  form.set("text", text);
  form.set("html", html);

  const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch(
    `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailgun ${res.status} ${res.statusText}: ${body}`);
  }

  return (await res.json()) as { id: string; message: string };
}

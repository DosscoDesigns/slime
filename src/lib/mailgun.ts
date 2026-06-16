// Minimal Mailgun sender (HTTP API, no SDK). Ported from rkpm — reads
// process.env directly instead of a dedicated env module.

interface SendMailParams {
  to: string;
  bcc?: string;
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
  bcc,
  subject,
  text,
  html,
}: SendMailParams): Promise<{ id: string; message: string }> {
  assertMailgunConfigured();

  const form = new URLSearchParams();
  form.set("from", process.env.MAILGUN_FROM!);
  form.set("to", to);
  if (bcc) form.set("bcc", bcc);
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

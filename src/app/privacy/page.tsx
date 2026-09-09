import PageShell from "@/components/PageShell";
import { CONTACT_EMAIL, LEGAL_NAME, pageMetadata } from "@/lib/site";

/**
 * Privacy policy.
 *
 * REWRITTEN when analytics landed, and that was not optional. The previous
 * version — which lived in a modal — said "No tracking cookies, no ad pixels,
 * no creepy stuff." GA4 sets cookies, so the moment it was added that sentence
 * became false. A privacy policy that misdescribes what the site does is worse
 * than no policy: it is a representation to customers and to Google, and both
 * of them can act on it.
 *
 * If a vendor is ever added or removed, THIS PAGE IS PART OF THE CHANGE.
 */

const LAST_UPDATED = "2026-09-09";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "What The Slime Co collects, why, who we share it with, and how to opt out. Plain language, no dark patterns.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      intro="What we collect, why we collect it, and how to tell us to stop. Written to be read, not to be scrolled past."
      updated={LAST_UPDATED}
    >
      <p>
        This policy covers theslimecompany.com, operated by{" "}
        <strong>{LEGAL_NAME}</strong>.
      </p>

      <h2>What we collect</h2>

      <h3>When you place an order</h3>
      <p>
        Your name, email address, shipping address, and phone number if you
        provide one. We need these to charge you, ship to you, and tell you it
        shipped.
      </p>
      <p>
        <strong>We never see or store your card number.</strong> Payment details
        go directly to Stripe, our payment processor, and our systems only ever
        receive a confirmation that a payment succeeded.
      </p>

      <h3>When you browse</h3>
      <p>
        We use two analytics tools, and they work differently on purpose:
      </p>
      <ul>
        <li>
          <strong>Plausible Analytics</strong> — cookieless and aggregate. It
          records that a visit happened, roughly where from, and which pages
          were viewed. It does not set cookies, does not track you across other
          websites, and does not build a profile of you.
        </li>
        <li>
          <strong>Google Analytics 4</strong> — sets cookies in your browser to
          recognise a returning visit and to follow a single shopping session
          from browsing to checkout. This is what tells us which kits people
          actually buy and where the checkout loses people. We have it
          configured to <strong>exclude your data from ad personalization</strong>.
        </li>
      </ul>
      <p>
        Neither tool receives your name, email or address. When our server
        records a completed order for analytics, it sends the order total and
        the items — never who bought them.
      </p>

      <h3>Cookies and local storage</h3>
      <ul>
        <li>
          <strong>Your cart</strong> is kept in your browser&apos;s local
          storage so it survives a refresh. It never leaves your device until
          you check out.
        </li>
        <li>
          <strong>Google Analytics cookies</strong> as described above.
        </li>
        <li>
          <strong>No advertising cookies.</strong> We run no ads, no retargeting
          pixels, and no third-party ad networks on this site.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only the services that make an order happen, and only what each one
        needs:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing. Receives your payment
          and billing details directly.
        </li>
        <li>
          <strong>Mailgun</strong> — sends your order confirmation and shipping
          emails. Receives your email address.
        </li>
        <li>
          <strong>Shippo and USPS</strong> — shipping labels and delivery.
          Receive your name and shipping address, because that is what a parcel
          label is.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the site and processes requests.
        </li>
        <li>
          <strong>Google Analytics and Plausible</strong> — as described above.
        </li>
      </ul>
      <p>
        <strong>
          We do not sell your personal information, and we do not share it for
          cross-context behavioural advertising.
        </strong>{" "}
        We do not rent, trade, or hand your details to marketers. There is no
        arrangement under which that could happen.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order records are retained as long as we need them for tax, accounting
        and warranty purposes — generally seven years, which is what US
        recordkeeping expects. Analytics data is retained on each provider&apos;s
        standard schedule and is aggregate rather than personal.
      </p>

      <h2>Your choices</h2>

      <h3>Opting out of analytics</h3>
      <ul>
        <li>
          Any standard content blocker will stop Google Analytics. So will
          Google&apos;s own{" "}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            opt-out browser add-on
          </a>
          .
        </li>
        <li>
          Plausible has nothing to opt out of — it holds nothing tied to you.
        </li>
        <li>
          Clearing your cookies removes the Google Analytics identifier
          entirely.
        </li>
      </ul>

      <h3>Your rights over your data</h3>
      <p>
        Wherever you live, you can ask us what personal information we hold
        about you, ask for a copy of it, ask us to correct it, or ask us to
        delete it. Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and a person
        will handle it — there is no form to fill in and no account to log into.
      </p>
      <p>
        We will not treat you differently for exercising any of these rights.
        The one thing we cannot delete on request is a record we are legally
        required to keep, such as a completed sale for tax purposes.
      </p>

      <h2>Children</h2>
      <p>
        Slime is for kids; buying slime is not. This site is intended for
        purchases by adults, and we do not knowingly collect personal
        information from anyone under 13. If you believe a child has given us
        their information, email us and we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        The site is served over HTTPS everywhere. Card data never touches our
        systems. Order records live in Stripe rather than in a database of our
        own, which means there is materially less of your information sitting
        anywhere for us to lose.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we add or remove a service that touches your data, we update this
        page and change the date at the top. We do not quietly broaden what we
        collect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or concerns:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PageShell>
  );
}

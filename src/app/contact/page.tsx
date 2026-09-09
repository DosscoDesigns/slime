import Link from "next/link";
import PageShell from "@/components/PageShell";
import {
  CONTACT_EMAIL,
  LEGAL_NAME,
  SITE_NAME,
  SITE_URL,
  pageMetadata,
} from "@/lib/site";

/**
 * Contact page.
 *
 * Exists mainly because Google Merchant Center expects a shopper to be able to
 * reach a real person before it will approve product listings, and "a mailto:
 * in the footer" is the thin end of what satisfies that. It is also the page a
 * cautious first-time buyer looks for before spending $68 with a brand they
 * have not heard of, so it is worth more than its word count.
 *
 * NOTE: a published phone number would materially strengthen the Merchant
 * Center review. Not adding one unilaterally — that is Jason's to decide.
 */

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Questions about a slime kit, an order, or a large event? Email The Slime Co and a real person will answer, usually within one business day.",
  path: "/contact",
});

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": `${SITE_URL}/contact#contactpage`,
  url: `${SITE_URL}/contact`,
  name: `Contact ${SITE_NAME}`,
  mainEntity: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: CONTACT_EMAIL,
      availableLanguage: "English",
      areaServed: "US",
    },
  },
};

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Built from constants above; no user input reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <PageShell
        title="Contact Us"
        intro="A real person reads every email. There is no ticket system and no chatbot."
      >
        <h2>Email us</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          We answer within <strong>one business day</strong>, usually faster. If
          you are emailing about an existing order, include your order number or
          the email address you ordered with and it will be quicker.
        </p>

        <h2>What we can help with</h2>
        <ul>
          <li>
            <strong>Which kit do I need?</strong> Tell us how many people and
            what kind of event, and we will tell you straight — including when
            a smaller kit is enough.
          </li>
          <li>
            <strong>Will it arrive in time?</strong> Give us your event date and
            zip code before you order and we will tell you honestly whether it
            makes it.
          </li>
          <li>
            <strong>Something went wrong.</strong> Damaged, wrong, or missing —
            see <Link href="/shipping-returns">Shipping &amp; Returns</Link>, or just
            email us with a photo.
          </li>
          <li>
            <strong>Big events, camps and fundraisers.</strong> If you are
            planning something larger than an 80-gallon kit, email us rather
            than adding four to the cart. We can usually do better on both price
            and shipping.
          </li>
          <li>
            <strong>Press, partnerships and content.</strong> Same address.
          </li>
        </ul>

        <h2>Business details</h2>
        <p>
          {SITE_NAME} is a product of <strong>{LEGAL_NAME}</strong>, based in
          Florida, USA. All orders ship from Florida.
        </p>

        <h2>Before you email</h2>
        <p>
          The <Link href="/#faq">FAQ</Link> answers the most common questions —
          coverage, mixing, cleanup, and how long mixed slime lasts. If your
          answer is there you will get it faster than we can reply.
        </p>
      </PageShell>
    </>
  );
}

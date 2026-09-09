import Link from "next/link";
import PageShell from "@/components/PageShell";
import { CONTACT_EMAIL, LEGAL_NAME, SITE_NAME, pageMetadata } from "@/lib/site";

const LAST_UPDATED = "2026-09-09";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "The terms that apply when you buy from The Slime Co: products, pricing, safe use, liability and intellectual property.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <PageShell
      title="Terms of Service"
      intro={`The rules of the road for buying from ${SITE_NAME}. Short, and in English.`}
      updated={LAST_UPDATED}
    >
      <p>
        By purchasing from {SITE_NAME}, operated by <strong>{LEGAL_NAME}</strong>,
        you agree to these terms.
      </p>

      <h2>Products</h2>
      <p>
        Our slime powder is intended for <strong>outdoor recreational use</strong>.
        Follow the instructions included with your kit — the powder is designed
        for a specific water ratio and going off-script mostly produces
        disappointment rather than danger, but it does produce disappointment.
      </p>
      <p>
        We recommend adult supervision for children under 12. Yield figures
        (20, 40 and 80 gallons) are what the kit makes when mixed as directed;
        mixing thinner will make more and thicker will make less.
      </p>

      <h2>Ordering and pricing</h2>
      <ul>
        <li>All prices are in US dollars.</li>
        <li>
          Your order is charged at the total shown at checkout, including
          shipping and any applicable sales tax.
        </li>
        <li>
          We may adjust pricing at any time, but never retroactively — a placed
          order is charged at the price you were shown.
        </li>
        <li>
          If we cannot fulfil an order (stock, an address we cannot ship to, a
          pricing error), we will cancel it and refund you in full rather than
          substitute something you did not choose.
        </li>
        <li>
          Discount codes may be limited to one use per customer and can expire
          or be withdrawn.
        </li>
      </ul>

      <h2>Shipping and returns</h2>
      <p>
        Covered in full on our <Link href="/shipping-returns">Shipping &amp; Returns</Link>{" "}
        page, which forms part of these terms.
      </p>

      <h2>Safe use and liability</h2>
      <p>
        Our slime is non-toxic and safe when used as directed. It is still a
        large volume of coloured liquid, and you should treat it that way:
      </p>
      <ul>
        <li>
          Use it <strong>outdoors</strong>, on surfaces that can get messy and
          be hosed down.
        </li>
        <li>
          Wear clothes you do not mind sacrificing. The formula washes out of
          most fabrics, but we do not promise it washes out of all of them.
        </li>
        <li>Keep it out of eyes. Goggles exist for a reason and we sell them.</li>
        <li>
          Wet surfaces are slippery. Think about where people will be running.
        </li>
      </ul>
      <p>
        To the fullest extent permitted by law, {LEGAL_NAME} is not responsible
        for staining, property damage, injury arising from misuse, or any
        indirect or consequential loss connected with use of the product. Our
        total liability is limited to what you paid for the order. Nothing in
        these terms limits liability that cannot be limited by law.
      </p>

      <h2>Events and resale</h2>
      <p>
        Buying a kit for a fundraiser, camp, church event or paid event is
        expressly fine and is what most of them are for. Reselling the powder
        as your own product, or repackaging it under another brand, is not.
      </p>

      <h2>Intellectual property</h2>
      <p>
        All content, branding, photography and product formulation on this site
        is the property of {LEGAL_NAME}. Our formula is proprietary. You may
        share photos and video of your own event freely — we would love it — but
        please do not copy the site&apos;s content or represent our product as
        yours.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Florida, USA.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The version in force for your order is the
        one published when you placed it, and the date at the top of this page
        tells you when it last changed.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </PageShell>
  );
}

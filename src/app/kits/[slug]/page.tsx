import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import KitBuyBox from "@/components/KitBuyBox";
import { productNode } from "@/components/StructuredData";
import {
  ADDON_DEFS,
  KIT_TIERS,
  KIT_TIERS_BY_SLUG,
  type KitTier,
} from "@/lib/products";
import {
  SHIPPING_FLAT_CENTS,
  SHIPPING_FREE_THRESHOLD_CENTS,
} from "@/lib/pricing";
import { SITE_NAME, SITE_URL, absoluteUrl, pageMetadata } from "@/lib/site";

/**
 * One page per kit.
 *
 * The storefront was a single page with all three kits under `/#products`, so
 * every Product in our structured data pointed at the same URL. Google cannot
 * rank, list, or feed three products that share one address — and "40 gallon
 * slime kit" is a query with buying intent that had no page to answer it.
 *
 * Statically generated: the whole point is that the content is in the HTML.
 */

export function generateStaticParams() {
  return KIT_TIERS.map((tier) => ({ slug: tier.slug }));
}

/** Unknown slug -> 404, never a soft 200 with empty content. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tier = KIT_TIERS_BY_SLUG[slug];
  if (!tier) return {};

  return pageMetadata({
    // Leads with the size and the noun a buyer actually searches, not the
    // brand-voice kit name — "40 Gallon Slime Powder Kit" is the query.
    title: `${tier.gallons} Gallon Slime Powder Kit — ${tier.name}`,
    description: `${tier.tagline}. Makes ${tier.gallons} gallons of thick, colorful slime from powder — just add water. $${tier.basePrice.toFixed(2)}, ships from Florida.`,
    path: `/kits/${tier.slug}`,
    image: tier.image.src,
  });
}

const usd = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

function breadcrumbs(tier: KitTier) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${SITE_URL}/kits/${tier.slug}#breadcrumbs`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Slime Powder Kits",
        item: `${SITE_URL}/#products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${tier.gallons} Gallon Kit`,
        item: absoluteUrl(`/kits/${tier.slug}`),
      },
    ],
  };
}

export default async function KitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tier = KIT_TIERS_BY_SLUG[slug];
  if (!tier) notFound();

  const others = KIT_TIERS.filter((t) => t.gallons !== tier.gallons);
  const perGallon = (tier.basePrice / tier.gallons).toFixed(2);

  return (
    <>
      <script
        type="application/ld+json"
        // Product node is the SHARED one from StructuredData — the price here
        // can never disagree with the price on the home page.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [productNode(tier), breadcrumbs(tier)],
          }),
        }}
      />

      <Navigation />

      <main className="pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Visible breadcrumb, matching the JSON-LD above. */}
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-gray-600">
            <Link href="/" className="hover:text-lime transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/#products" className="hover:text-lime transition-colors">
              Kits
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-400">{tier.gallons} Gallon</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Image. Explicit width/height + srcSet: layout shift is a Core
                Web Vitals input, and this is the page's LCP element. */}
            <img
              src={tier.image.src}
              srcSet={`${tier.image.srcSmall} 700w, ${tier.image.src} ${tier.image.width}w`}
              sizes="(max-width: 1024px) 100vw, 50vw"
              width={tier.image.width}
              height={tier.image.height}
              alt={tier.image.alt}
              fetchPriority="high"
              className="w-full rounded-3xl border border-white/10"
            />

            <div>
              <p className="text-lime font-bold uppercase tracking-wider text-sm mb-3">
                {tier.name}
                {tier.popular && " · Most Popular"}
              </p>

              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
                {tier.gallons} Gallon Slime Powder Kit
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                {tier.description}
              </p>

              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-black text-white">
                  ${tier.basePrice.toFixed(2)}
                </span>
                <span className="text-gray-500">
                  about ${perGallon} a gallon
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-8">
                {usd(SHIPPING_FLAT_CENTS)} flat shipping · free over{" "}
                {usd(SHIPPING_FREE_THRESHOLD_CENTS)} · ships in 1–3 business
                days
              </p>

              <KitBuyBox tier={tier} />

              <p className="text-gray-600 text-sm mt-4">
                Pick your colors and add supplies in the next step.
              </p>
            </div>
          </div>

          {/* What you get */}
          <section className="mt-24">
            <h2 className="text-3xl font-black text-white mb-8">
              What&apos;s in the {tier.gallons} gallon kit
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  title: `Powder for ${tier.gallons} gallons`,
                  body: `Enough of our proprietary powder to mix ${tier.gallons} gallons of thick, vivid slime. ${tier.tagline}.`,
                },
                {
                  title: "Your choice of color",
                  body: "Red, green, blue or yellow — or one of each, split across the kit, at no extra cost.",
                },
                {
                  title: "Instructions that fit on a card",
                  body: "Add water, stir, wait a few minutes. There is no cooking, no measuring by weight, and no mixing station to build.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <h3 className="text-white font-bold mb-2">{c.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Add-ons */}
          <section className="mt-20">
            <h2 className="text-3xl font-black text-white mb-3">
              Add supplies at kit pricing
            </h2>
            <p className="text-gray-400 mb-8 max-w-2xl">
              Optional, and cheaper bought with a kit than separately. You can
              also buy all of these locally — we would rather tell you that than
              sell you something you already own.
            </p>
            <div className="grid sm:grid-cols-3 gap-6">
              {ADDON_DEFS.map((addon) => (
                <div
                  key={addon.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div className="text-3xl mb-3" aria-hidden="true">
                    {addon.icon}
                  </div>
                  <h3 className="text-white font-bold">{addon.name}</h3>
                  <p className="text-gray-400 text-sm mt-1 mb-3">
                    {addon.description}
                  </p>
                  <p className="text-sm">
                    <span className="text-lime font-bold">
                      ${addon.kitPrice}
                    </span>
                    <span className="text-gray-600 line-through ml-2">
                      ${addon.retailPrice}
                    </span>
                    <span className="text-gray-500 ml-2">each</span>
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    We suggest about{" "}
                    {Math.round((addon.suggestedPer20 * tier.gallons) / 20)} for
                    a {tier.gallons} gallon event.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Cross-sell to the other sizes — internal links Google can follow,
              and the comparison a buyer is actually making. */}
          <section className="mt-20">
            <h2 className="text-3xl font-black text-white mb-8">
              Not sure this is the right size?
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {others.map((other) => (
                <Link
                  key={other.gallons}
                  href={`/kits/${other.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex gap-5 items-center hover:border-lime/40 transition-colors"
                >
                  <img
                    src={other.image.srcSmall}
                    width={700}
                    height={Math.round(
                      (700 * other.image.height) / other.image.width
                    )}
                    alt={other.image.alt}
                    loading="lazy"
                    className="w-24 h-24 object-cover rounded-xl shrink-0"
                  />
                  <div>
                    <h3 className="text-white font-bold group-hover:text-lime transition-colors">
                      {other.gallons} Gallon Kit — {other.name}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">{other.tagline}</p>
                    <p className="text-lime font-bold text-sm mt-2">
                      ${other.basePrice.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Shipping reassurance, linking to the real policy page. */}
          <section className="mt-20 rounded-3xl border border-white/10 bg-white/[0.02] p-8">
            <h2 className="text-2xl font-black text-white mb-4">
              Shipping and returns
            </h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Ships from Florida via USPS, {usd(SHIPPING_FLAT_CENTS)} flat and
              free over {usd(SHIPPING_FREE_THRESHOLD_CENTS)}. Packed within 1–3
              business days, then typically 5–7 business days in transit.
              Unopened kits can be returned within 30 days.
            </p>
            <p className="text-gray-400">
              <Link
                href="/shipping-returns"
                className="text-lime underline underline-offset-4 hover:text-lime/80"
              >
                Full shipping &amp; returns policy
              </Link>
              {" · "}
              <Link
                href="/contact"
                className="text-lime underline underline-offset-4 hover:text-lime/80"
              >
                Ordering for a dated event? Ask us first
              </Link>
            </p>
          </section>

          <p className="mt-16 text-center text-gray-600 text-sm">
            {SITE_NAME} · {tier.sku}
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}

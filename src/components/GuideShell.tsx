import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PROSE } from "@/components/PageShell";
import { KIT_TIERS_BY_GALLONS, type KitTier } from "@/lib/products";

/**
 * Shell for the use-case and how-to pages.
 *
 * These exist because the storefront was one URL, and one URL can rank for one
 * thing. The competition (Party Goat) outranks us almost entirely on content
 * depth, and queries like "slime the teacher fundraiser" have obvious buying
 * intent and no page here to answer them.
 *
 * Every guide ends by recommending a specific kit and linking to it — a page
 * that ranks and does not sell is a page that costs money to keep.
 */

function KitRecommendation({ gallons, why }: { gallons: number; why: string }) {
  const tier: KitTier | undefined = KIT_TIERS_BY_GALLONS[gallons];
  if (!tier) return null;

  return (
    <aside className="not-prose my-12 rounded-3xl border border-lime/30 bg-lime/[0.04] p-8">
      <p className="text-lime font-bold uppercase tracking-wider text-xs mb-4">
        Our recommendation
      </p>
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <img
          src={tier.image.srcSmall}
          width={700}
          height={Math.round((700 * tier.image.height) / tier.image.width)}
          alt={tier.image.alt}
          loading="lazy"
          className="w-full sm:w-40 h-40 object-cover rounded-2xl shrink-0"
        />
        <div>
          <h3 className="text-white font-black text-xl mb-1">
            {tier.gallons} Gallon Kit — {tier.name}
          </h3>
          <p className="text-lime font-bold mb-3">
            ${tier.basePrice.toFixed(2)}
          </p>
          <p className="text-gray-400 leading-relaxed mb-5">{why}</p>
          <Link
            href={`/kits/${tier.slug}`}
            className="inline-block bg-lime text-black px-7 py-3 rounded-full font-bold transition-transform hover:scale-[1.03]"
          >
            See the {tier.gallons} gallon kit
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default function GuideShell({
  title,
  intro,
  hero,
  recommend,
  children,
  related,
}: {
  title: string;
  intro: string;
  hero: { src: string; srcSmall: string; width: number; height: number; alt: string };
  recommend?: { gallons: number; why: string };
  children: React.ReactNode;
  related?: { name: string; href: string }[];
}) {
  return (
    <>
      <Navigation />
      <main className="pt-28 pb-24 px-6">
        <article className="max-w-3xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
              {title}
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">{intro}</p>
          </header>

          {/* LCP element on these pages — explicit dimensions, high priority. */}
          <img
            src={hero.src}
            srcSet={`${hero.srcSmall} 700w, ${hero.src} ${hero.width}w`}
            sizes="(max-width: 768px) 100vw, 768px"
            width={hero.width}
            height={hero.height}
            alt={hero.alt}
            fetchPriority="high"
            className="w-full rounded-3xl border border-white/10 mb-4"
          />

          <div className={PROSE}>{children}</div>

          {recommend && <KitRecommendation {...recommend} />}

          {related && related.length > 0 && (
            <nav className="mt-16 pt-8 border-t border-white/10">
              <h2 className="text-white font-bold mb-4">Keep reading</h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="text-lime underline underline-offset-4 hover:text-lime/80"
                    >
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}

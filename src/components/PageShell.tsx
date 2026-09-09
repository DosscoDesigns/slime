import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

/**
 * Shell for the non-storefront pages: policies, contact, guides.
 *
 * These exist because content sitting in a modal has no URL, and a policy with
 * no URL cannot be crawled, cannot be linked from a Merchant Center account,
 * and cannot back the returns promise our Product JSON-LD already makes.
 *
 * Prose styling is done with Tailwind's arbitrary-descendant variants rather
 * than @tailwindcss/typography — one class here instead of a plugin, a build
 * step and a theme override to keep the dark palette from being fought.
 */

export const PROSE = [
  "[&_p]:text-gray-400 [&_p]:leading-relaxed [&_p]:mb-4",
  "[&_h2]:text-white [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-12 [&_h2]:mb-4",
  "[&_h3]:text-white [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-8 [&_h3]:mb-3",
  "[&_ul]:mb-6 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc",
  "[&_li]:text-gray-400 [&_li]:leading-relaxed [&_li]:marker:text-lime/60",
  "[&_strong]:text-white [&_strong]:font-semibold",
  "[&_a]:text-lime [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-lime/80",
  "[&_dt]:text-white [&_dt]:font-semibold [&_dt]:mt-6",
  "[&_dd]:text-gray-400 [&_dd]:leading-relaxed",
].join(" ");

export default function PageShell({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  /** ISO date. Rendered for humans and as a machine-readable <time>. */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navigation />
      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            {/* Exactly one h1 per page — the pages exist to rank. */}
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              {title}
            </h1>
            {intro && <p className="text-gray-400 text-lg leading-relaxed">{intro}</p>}
            {updated && (
              <p className="text-gray-600 text-sm mt-6">
                Last updated{" "}
                <time dateTime={updated}>
                  {new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </p>
            )}
          </header>
          <div className={PROSE}>{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}

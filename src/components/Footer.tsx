import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

/**
 * Site footer.
 *
 * WAS a client component holding the shipping, privacy and terms text inside a
 * modal. That content now lives at real URLs (/shipping-returns, /privacy,
 * /terms) because a policy in a modal has no address: Google cannot crawl it,
 * Merchant Center cannot be pointed at it, and it could not back the returns
 * promise our Product JSON-LD already makes.
 *
 * Dropping the modal also dropped the last reason for this to be a client
 * component — the one hover animation became a CSS transition — so the footer
 * now ships no JavaScript on any page that renders it.
 *
 * In-page links are root-relative (`/#products`, not `#products`) so they work
 * from the policy and kit pages too, where a bare hash points at nothing.
 */

const shopLinks = [
  { name: "All Kits", href: "/#products" },
  { name: "20 Gallon Kit", href: "/kits/20-gallon-slime-powder-kit" },
  { name: "40 Gallon Kit", href: "/kits/40-gallon-slime-powder-kit" },
  { name: "80 Gallon Kit", href: "/kits/80-gallon-slime-powder-kit" },
];

const useCaseLinks = [
  { name: "Slime the Teacher", href: "/slime-the-teacher-fundraiser" },
  { name: "Church Fundraisers", href: "/church-slime-fundraiser" },
  { name: "Youth Group Events", href: "/youth-group-slime-event" },
  { name: "Color Runs", href: "/color-run-slime" },
  { name: "How to Make Slime", href: "/how-to-make-slime-from-powder" },
];

const supportLinks = [
  { name: "Shipping & Returns", href: "/shipping-returns" },
  { name: "Contact Us", href: "/contact" },
  { name: "How It Works", href: "/#how-it-works" },
  { name: "FAQ", href: "/#faq" },
];

function LinkColumn({
  heading,
  links,
}: {
  heading: string;
  links: { name: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-white font-bold mb-4 text-sm">{heading}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-gray-500 hover:text-lime transition-colors text-sm"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="inline-block text-2xl font-bold tracking-tight mb-4 transition-transform hover:scale-[1.02]"
            >
              <span className="text-lime">THE SLIME</span>{" "}
              <span className="text-white">CO</span>
            </Link>
            <p className="text-gray-500 max-w-sm text-sm">
              Premium slime powder kits that turn any event into an
              unforgettable experience. Just add water.
            </p>
            <p className="text-gray-600 text-sm mt-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="hover:text-lime transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>

          <LinkColumn heading="Shop" links={shopLinks} />
          <LinkColumn heading="Ideas" links={useCaseLinks} />
          <LinkColumn heading="Support" links={supportLinks} />
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

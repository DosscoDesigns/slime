"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

const MFG = [
  { href: "/admin/manufacturing", label: "Mix" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/packaging", label: "Package" },
];
const MFG_PATHS = [...MFG.map((m) => m.href), "/admin/labels"];

const LINKS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/manufacturing", label: "Manufacturing", section: MFG_PATHS },
  { href: "/admin/coupons", label: "Coupons" },
];

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function isActive(pathname: string, l: (typeof LINKS)[number]): boolean {
  if (l.section) return l.section.some((p) => under(pathname, p));
  if (l.href === "/admin") return pathname === "/admin" || under(pathname, "/admin/orders");
  return under(pathname, l.href);
}

export default function AdminNav() {
  const pathname = usePathname();
  const inMfg = MFG_PATHS.some((p) => under(pathname, p));
  return (
    <header className="sticky top-0 z-20 print:hidden border-b border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-5 py-3 text-sm">
        <span className="shrink-0 font-extrabold tracking-tight text-lime-400">Slime Co Admin</span>
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={`shrink-0 ${
              isActive(pathname, l) ? "font-semibold text-zinc-100" : "text-zinc-400 hover:text-lime-400"
            }`}
          >
            {l.label}
          </Link>
        ))}
        <form action={signOut} className="ml-auto shrink-0">
          <button type="submit" className="text-zinc-500 hover:text-zinc-300">
            Sign out
          </button>
        </form>
      </nav>
      {inMfg ? (
        <nav className="border-t border-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-5 py-1.5 text-sm">
            {MFG.map((m, i) => {
              const active =
                under(pathname, m.href) || (m.href === "/admin/packaging" && under(pathname, "/admin/labels"));
              return (
                <span key={m.href} className="flex shrink-0 items-center gap-1">
                  {i > 0 ? <span className="px-1 text-zinc-700">→</span> : null}
                  <Link
                    href={m.href}
                    className={`rounded px-2 py-0.5 ${
                      active ? "bg-lime-400/15 font-semibold text-lime-300" : "text-zinc-400 hover:text-lime-400"
                    }`}
                  >
                    {m.label}
                  </Link>
                </span>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

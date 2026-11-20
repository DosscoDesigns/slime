"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

const LINKS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/manufacturing", label: "Manufacturing" },
  { href: "/admin/packaging", label: "Packaging" },
  { href: "/admin/lots", label: "Lots" },
  { href: "/admin/coupons", label: "Coupons" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/orders");
  return pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 print:hidden border-b border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-5 py-3 text-sm">
        <span className="shrink-0 font-extrabold tracking-tight text-lime-400">Slime Co Admin</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 ${
              isActive(pathname, l.href) ? "font-semibold text-zinc-100" : "text-zinc-400 hover:text-lime-400"
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
    </header>
  );
}

import type { Metadata } from "next";

/**
 * The admin screens show every customer's name, address and email and can
 * spend money buying postage. They must never be indexed — noindex here, and
 * /admin is disallowed in robots.ts. They are deliberately absent from
 * sitemap.ts for the same reason.
 */
export const metadata: Metadata = {
  title: "Slime Co Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">{children}</div>;
}

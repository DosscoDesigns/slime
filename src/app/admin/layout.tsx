import type { Metadata } from "next";
import { isSignedIn } from "@/lib/admin-session";
import AdminNav from "./admin-nav";

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

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The menu is chrome, not a gate: every page still calls requireAdmin().
  const signedIn = await isSignedIn();
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {signedIn ? <AdminNav /> : null}
      {children}
    </div>
  );
}

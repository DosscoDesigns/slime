import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import CartDrawer from "@/components/CartDrawer";
import StructuredData from "@/components/StructuredData";
import Analytics from "@/components/Analytics";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every relative URL below (OG image, canonical) resolves against this, so
  // it has to be set or Next emits relative OG paths that crawlers drop.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Slime Powder Kits — Just Add Water | The Slime Co",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    // The apex 307s to www; declaring the canonical stops the two hosts from
    // splitting signals if anything ever links to the apex directly.
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "Slime Powder Kits — Just Add Water | The Slime Co",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "A field of people covered in colorful slime at a Slime Co event",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Slime Powder Kits — Just Add Water | The Slime Co",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "shopping",
  /**
   * Search-engine ownership proof. Both are meta-tag verification, which is
   * the method that survives a DNS provider change — the records themselves
   * live in Cloudflare and are easy to lose track of.
   *
   * Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION and REDEPLOY: these
   * are read at build time, so pasting the value into Vercel is only half the
   * job. Unset means the key is omitted entirely rather than emitted empty.
   */
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <StructuredData />
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
        {/* Last in the body: nothing above it waits on a tag to load. */}
        <Analytics />
      </body>
    </html>
  );
}

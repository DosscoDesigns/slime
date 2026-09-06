import type { Metadata } from "next";

/**
 * The order-confirmation page is only reachable after a payment and can carry
 * a PaymentIntent id in the query string — it must never be indexed. The page
 * itself is a client component and so can't export metadata; this layout does
 * it instead. Also disallowed in robots.ts.
 */
export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false, nocache: true },
};

export default function SuccessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

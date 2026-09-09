"use client";

import Script from "next/script";
import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { useReportWebVitals } from "next/web-vitals";
import {
  GA_MEASUREMENT_ID,
  PLAUSIBLE_DOMAIN,
  gaConfigured,
  plausibleConfigured,
} from "@/lib/analytics";

/**
 * Mounts the analytics vendors. Rendered once, from the root layout.
 *
 * Both are opt-in on an env var, so a preview deploy or a local dev server
 * pollutes neither property. See src/lib/analytics.ts for why there are two.
 *
 * PERFORMANCE — this sits in the root layout, which is exactly where a badly
 * loaded tag wrecks LCP, and LCP is a ranking input for us (CLAUDE.md, "SEO is
 * a standing requirement"). Both tags load `afterInteractive`: after the page
 * is usable, never blocking the hero image. Nothing here runs before paint.
 *
 * CONSENT — no banner, deliberately. The store ships to the US only and runs
 * no ad remarketing, so under CCPA/CPRA notice-plus-opt-out (satisfied by
 * /privacy) is the requirement, not prior consent. Plausible is cookieless and
 * outside the question entirely. If we ever run Google Ads to EEA/UK traffic,
 * that changes: Consent Mode v2 with `analytics_storage: denied` by default
 * plus a banner becomes mandatory, and it has to be wired in ahead of the
 * gtag config call — which means it goes here, above <GoogleAnalytics>.
 */
export default function Analytics() {
  useReportWebVitals((metric) => {
    // Only the three metrics Google actually ranks on. Next reports FCP and
    // TTFB too, but sending all five doubles the event volume to measure
    // things that are diagnostic rather than ranking-relevant.
    if (!gaConfigured) return;
    if (!["LCP", "CLS", "INP"].includes(metric.name)) return;

    sendGAEvent("event", metric.name, {
      // CLS is a unitless ratio in the 0–1 range; GA4 metric values are
      // integers, so it is scaled by 1000 by convention and read back as
      // thousandths. Every other metric is already in milliseconds.
      value: Math.round(metric.name === "CLS" ? metric.delta * 1000 : metric.delta),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      non_interaction: true,
    });
  });

  return (
    <>
      {plausibleConfigured && (
        <>
          {/*
            Queue stub, and it has to come first. Plausible's own snippet
            defines this so events fired before the script finishes loading are
            buffered rather than dropped — without it, an "Add to Cart" from a
            fast clicker on a slow connection silently disappears.
          */}
          <Script id="plausible-init" strategy="afterInteractive">
            {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}`}
          </Script>
          {/*
            Extension bundle, in one file:
              file-downloads  — PDF/asset clicks
              outbound-links  — clicks off to Amazon/Shopify listings
              revenue         — money on the Purchase goal
              tagged-events   — manual window.plausible() calls
            Verified this exact filename serves a real 4.9KB build; an
            unrecognised extension name 404s and takes analytics down silently,
            so do not edit this string casually.
          */}
          <Script
            defer
            strategy="afterInteractive"
            data-domain={PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.file-downloads.outbound-links.revenue.tagged-events.js"
          />
        </>
      )}

      {gaConfigured && <GoogleAnalytics gaId={GA_MEASUREMENT_ID!} />}
    </>
  );
}

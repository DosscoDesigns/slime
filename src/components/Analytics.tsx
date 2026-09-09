"use client";

import Script from "next/script";
import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { useReportWebVitals } from "next/web-vitals";
import {
  GA_MEASUREMENT_ID,
  PLAUSIBLE_SRC,
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
            Queue + init stub, verbatim from Plausible's own snippet, and it
            has to come first.

            `q` buffers events fired before the script finishes loading — an
            "Add to Cart" from a fast clicker on a slow connection would
            otherwise vanish. The loader drains that queue during init.

            `plausible.init()` stores its options on `plausible.o`, which the
            real script picks up when it arrives. The two are order-independent:
            if the script wins the race it installs the real `init`, and the
            `||` here leaves it alone.
          */}
          <Script id="plausible-init" strategy="afterInteractive">
            {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
          </Script>
          {/*
            Plausible's token-based loader. NOT the older
            `data-domain` + `script.<extensions>.js` form — this build compiles
            the site domain in, so there is no data-domain attribute and no
            extension filename to get wrong.

            outboundLinks, fileDownloads and formSubmissions default to ON in
            this build, and autoCapturePageviews patches history.pushState — so
            client-side navigations through next/link are counted, which the
            legacy script did NOT do without the manual variant.
          */}
          <Script defer strategy="afterInteractive" src={PLAUSIBLE_SRC} />
        </>
      )}

      {gaConfigured && <GoogleAnalytics gaId={GA_MEASUREMENT_ID!} />}
    </>
  );
}

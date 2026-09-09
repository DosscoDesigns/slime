"use client";

import { useEffect, useState } from "react";
import KitWizard from "@/components/KitWizard";
import { trackViewItem } from "@/lib/analytics";
import type { KitTier } from "@/lib/products";

/**
 * The only interactive part of a kit page: the buy button and the configurator
 * it opens.
 *
 * Kept as a small client island so /kits/[slug] itself stays a server
 * component and prerenders to static HTML — the page has to rank, so its
 * content must be in the markup rather than assembled after hydration.
 */
export default function KitBuyBox({ tier }: { tier: KitTier }) {
  const [open, setOpen] = useState(false);

  // A kit page IS the product detail view, so view_item belongs on arrival
  // rather than on the button. Firing it on the click would only ever count
  // the people who already decided.
  useEffect(() => {
    trackViewItem(tier);
  }, [tier]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto bg-lime text-black px-10 py-4 rounded-full font-bold text-lg transition-transform hover:scale-[1.03] active:scale-95 cursor-pointer"
      >
        Build Your {tier.gallons} Gallon Kit
      </button>
      <KitWizard tier={open ? tier : null} onClose={() => setOpen(false)} />
    </>
  );
}

"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import KitWizard, { KIT_TIERS, KitTier } from "./KitWizard";

const colorMap = {
  lime: { bg: "bg-lime/10", text: "text-lime", border: "border-lime/30", glow: "rgba(163, 230, 53, 0.15)" },
  purple: { bg: "bg-purple/10", text: "text-purple", border: "border-purple/30", glow: "rgba(192, 132, 252, 0.15)" },
  pink: { bg: "bg-pink/10", text: "text-pink", border: "border-pink/30", glow: "rgba(244, 114, 182, 0.15)" },
};

// Gallon-themed gradient backgrounds instead of broken Unsplash images
const tierGradients: Record<number, string> = {
  20: "from-lime/20 via-green-900/30 to-transparent",
  40: "from-purple/20 via-violet-900/30 to-transparent",
  80: "from-pink/20 via-rose-900/30 to-transparent",
};

function USABadge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 bg-blue-950/80 border border-blue-400/30 rounded-full px-3 py-1.5 shadow-lg shadow-blue-950/50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, type: "spring" }}
    >
      <svg width="20" height="14" viewBox="0 0 30 20" className="shrink-0 rounded-[2px] overflow-hidden" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
        <rect width="30" height="20" fill="#B22234" />
        <rect y="1.54" width="30" height="1.54" fill="white" />
        <rect y="4.62" width="30" height="1.54" fill="white" />
        <rect y="7.69" width="30" height="1.54" fill="white" />
        <rect y="10.77" width="30" height="1.54" fill="white" />
        <rect y="13.85" width="30" height="1.54" fill="white" />
        <rect y="16.92" width="30" height="1.54" fill="white" />
        <rect width="12" height="10.77" fill="#3C3B6E" />
        <g fill="white">
          <circle cx="1.5" cy="1.2" r="0.6" />
          <circle cx="3.5" cy="1.2" r="0.6" />
          <circle cx="5.5" cy="1.2" r="0.6" />
          <circle cx="7.5" cy="1.2" r="0.6" />
          <circle cx="9.5" cy="1.2" r="0.6" />
          <circle cx="11" cy="1.2" r="0.6" />
          <circle cx="2.5" cy="3.0" r="0.6" />
          <circle cx="4.5" cy="3.0" r="0.6" />
          <circle cx="6.5" cy="3.0" r="0.6" />
          <circle cx="8.5" cy="3.0" r="0.6" />
          <circle cx="10.5" cy="3.0" r="0.6" />
          <circle cx="1.5" cy="4.8" r="0.6" />
          <circle cx="3.5" cy="4.8" r="0.6" />
          <circle cx="5.5" cy="4.8" r="0.6" />
          <circle cx="7.5" cy="4.8" r="0.6" />
          <circle cx="9.5" cy="4.8" r="0.6" />
          <circle cx="11" cy="4.8" r="0.6" />
          <circle cx="2.5" cy="6.6" r="0.6" />
          <circle cx="4.5" cy="6.6" r="0.6" />
          <circle cx="6.5" cy="6.6" r="0.6" />
          <circle cx="8.5" cy="6.6" r="0.6" />
          <circle cx="10.5" cy="6.6" r="0.6" />
          <circle cx="1.5" cy="8.4" r="0.6" />
          <circle cx="3.5" cy="8.4" r="0.6" />
          <circle cx="5.5" cy="8.4" r="0.6" />
          <circle cx="7.5" cy="8.4" r="0.6" />
          <circle cx="9.5" cy="8.4" r="0.6" />
          <circle cx="11" cy="8.4" r="0.6" />
        </g>
      </svg>
      <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider whitespace-nowrap">
        Made in USA
      </span>
    </motion.div>
  );
}

export default function Products() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [wizardTier, setWizardTier] = useState<KitTier | null>(null);

  return (
    <>
      <section id="products" className="py-32 px-6 relative" ref={ref}>
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", stiffness: 50 }}
          >
            <motion.span
              className="text-lime text-sm font-bold tracking-widest uppercase"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2 }}
            >
              Our Kits
            </motion.span>
            <h2 className="text-4xl sm:text-6xl font-black mt-4 mb-6">
              Pick Your <span className="text-lime">Party</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">
              How much fun do you want? Choose your size, pick your color, and add supplies.
              Every kit ships with our premium powder formula.
            </p>
          </motion.div>

          {/* Kit tier cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {KIT_TIERS.map((tier, i) => {
              const colors = colorMap[tier.color];
              const gradient = tierGradients[tier.gallons];
              return (
                <motion.div
                  key={tier.gallons}
                  className={`relative rounded-3xl border ${colors.border} ${colors.bg} p-8 flex flex-col`}
                  initial={{ opacity: 0, y: 60 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 50 }}
                  whileHover={{
                    y: -8,
                    boxShadow: `0 20px 60px -10px ${colors.glow}`,
                  }}
                >
                  {tier.popular && (
                    <motion.div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple text-black text-xs font-bold px-4 py-1 rounded-full"
                      initial={{ scale: 0 }}
                      animate={isInView ? { scale: 1 } : {}}
                      transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                    >
                      Most Popular
                    </motion.div>
                  )}

                  {/* Gradient hero area */}
                  <div className={`rounded-2xl overflow-hidden mb-6 aspect-video relative bg-gradient-to-br ${gradient}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className={`text-6xl font-black ${colors.text}`}>
                          {tier.gallons}
                        </span>
                        <span className="block text-gray-400 text-sm font-medium mt-1">
                          GALLONS
                        </span>
                      </div>
                    </div>
                    {/* Made in USA badge */}
                    <div className="absolute top-3 right-3">
                      <USABadge />
                    </div>
                  </div>

                  <h3 className={`text-2xl font-bold ${colors.text}`}>
                    {tier.name}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">{tier.tagline}</p>
                  <p className="text-gray-300 mt-4 text-sm leading-relaxed flex-grow">
                    {tier.gallons === 20 &&
                      "Perfect for birthday parties and small group fun. Just add water to any 5-gallon bucket."}
                    {tier.gallons === 40 &&
                      "Double the slime for neighborhood block parties and school events. The sweet spot for most groups."}
                    {tier.gallons === 80 &&
                      "Go all out. Built for youth groups, camps, and anyone who wants total slime chaos."}
                  </p>

                  {/* What's included */}
                  <ul className="mt-6 space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={colors.text}>&#10003;</span>
                      {tier.gallons === 20 ? "4" : tier.gallons === 40 ? "8" : "16"} color pouches (RGBY)
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={colors.text}>&#10003;</span>
                      Choose your color or mix
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={colors.text}>&#10003;</span>
                      Add buckets, sprayers &amp; more
                    </li>
                  </ul>

                  {/* Price + CTA */}
                  <div className="mt-8 flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-black text-white">
                        ${tier.basePrice}
                      </span>
                    </div>
                    <motion.button
                      className={`${
                        tier.popular
                          ? "bg-purple text-black"
                          : `border ${colors.border} ${colors.text}`
                      } px-6 py-2.5 rounded-full text-sm font-bold cursor-pointer`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setWizardTier(tier)}
                    >
                      Build Your Kit
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kit Wizard Flyout */}
      <KitWizard tier={wizardTier} onClose={() => setWizardTier(null)} />
    </>
  );
}

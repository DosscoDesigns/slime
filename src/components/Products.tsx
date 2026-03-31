"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useCart } from "./CartProvider";

const products = [
  {
    id: "slime-only",
    name: "Slime Only",
    subtitle: "20 Gallons of Slime",
    price: 15,
    priceCents: 1500,
    description: "4 color pouches (Red, Yellow, Green, Blue). Just add water in any 5-gallon bucket.",
    features: ["4 color pouches", "Makes 20 gallons", "Just add water"],
    color: "lime" as const,
    popular: false,
    madeInUSA: true,
    image: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=600&h=400&fit=crop",
  },
  {
    id: "starter-kit",
    name: "Starter Kit",
    subtitle: "20 Gallons + Supplies",
    price: 59,
    priceCents: 5900,
    description: "Everything you need for an epic slime day. Buckets, sprayers, mixer, and 4 color pouches.",
    features: [
      "4 color pouches",
      "4 buckets",
      "12 sprayers",
      "1 mixing paddle",
    ],
    color: "purple" as const,
    popular: true,
    madeInUSA: true,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop",
  },
  {
    id: "youth-group-kit",
    name: "Youth Group Kit",
    subtitle: "80 Gallons of Chaos",
    price: 199,
    priceCents: 19900,
    description: "Built for big groups. 16 buckets, 48 sprayers, and enough slime to cover everyone.",
    features: [
      "16 color pouches",
      "16 buckets",
      "48 sprayers",
      "1 mixing paddle",
    ],
    color: "pink" as const,
    popular: false,
    madeInUSA: true,
    image: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600&h=400&fit=crop",
  },
];

const colorMap = {
  lime: { bg: "bg-lime/10", text: "text-lime", border: "border-lime/30" },
  purple: { bg: "bg-purple/10", text: "text-purple", border: "border-purple/30" },
  pink: { bg: "bg-pink/10", text: "text-pink", border: "border-pink/30" },
};

function USABadge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 bg-blue-950/80 border border-blue-400/30 rounded-full px-3 py-1.5 shadow-lg shadow-blue-950/50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, type: "spring" }}
    >
      {/* Clean crisp US flag */}
      <svg width="20" height="14" viewBox="0 0 30 20" className="shrink-0 rounded-[2px] overflow-hidden" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
        {/* Red and white stripes */}
        <rect width="30" height="20" fill="#B22234" />
        <rect y="1.54" width="30" height="1.54" fill="white" />
        <rect y="4.62" width="30" height="1.54" fill="white" />
        <rect y="7.69" width="30" height="1.54" fill="white" />
        <rect y="10.77" width="30" height="1.54" fill="white" />
        <rect y="13.85" width="30" height="1.54" fill="white" />
        <rect y="16.92" width="30" height="1.54" fill="white" />
        {/* Blue canton */}
        <rect width="12" height="10.77" fill="#3C3B6E" />
        {/* Stars - 5 rows */}
        <g fill="white">
          {/* Row 1: 6 stars */}
          <circle cx="1.5" cy="1.2" r="0.6" />
          <circle cx="3.5" cy="1.2" r="0.6" />
          <circle cx="5.5" cy="1.2" r="0.6" />
          <circle cx="7.5" cy="1.2" r="0.6" />
          <circle cx="9.5" cy="1.2" r="0.6" />
          <circle cx="11" cy="1.2" r="0.6" />
          {/* Row 2: 5 stars (offset) */}
          <circle cx="2.5" cy="3.0" r="0.6" />
          <circle cx="4.5" cy="3.0" r="0.6" />
          <circle cx="6.5" cy="3.0" r="0.6" />
          <circle cx="8.5" cy="3.0" r="0.6" />
          <circle cx="10.5" cy="3.0" r="0.6" />
          {/* Row 3: 6 stars */}
          <circle cx="1.5" cy="4.8" r="0.6" />
          <circle cx="3.5" cy="4.8" r="0.6" />
          <circle cx="5.5" cy="4.8" r="0.6" />
          <circle cx="7.5" cy="4.8" r="0.6" />
          <circle cx="9.5" cy="4.8" r="0.6" />
          <circle cx="11" cy="4.8" r="0.6" />
          {/* Row 4: 5 stars (offset) */}
          <circle cx="2.5" cy="6.6" r="0.6" />
          <circle cx="4.5" cy="6.6" r="0.6" />
          <circle cx="6.5" cy="6.6" r="0.6" />
          <circle cx="8.5" cy="6.6" r="0.6" />
          <circle cx="10.5" cy="6.6" r="0.6" />
          {/* Row 5: 6 stars */}
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
  const { addItem } = useCart();

  return (
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
            Pick Your <span className="text-lime">Level</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            From solo fun to full-scale slime wars. Every kit ships with our
            premium powder formula.
          </p>
        </motion.div>

        {/* Product cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {products.map((product, i) => {
            const colors = colorMap[product.color];
            return (
              <motion.div
                key={product.name}
                className={`relative rounded-3xl border ${colors.border} ${colors.bg} p-8 flex flex-col`}
                initial={{ opacity: 0, y: 60 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 50 }}
                whileHover={{
                  y: -8,
                  boxShadow: `0 20px 60px -10px var(--${product.color})33`,
                }}
              >
                {product.popular && (
                  <motion.div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple text-black text-xs font-bold px-4 py-1 rounded-full"
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : {}}
                    transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                  >
                    Most Popular
                  </motion.div>
                )}

                {/* Product image */}
                <div className="rounded-2xl overflow-hidden mb-6 aspect-video relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {/* Made in USA badge on image */}
                  {product.madeInUSA && (
                    <div className="absolute top-3 right-3">
                      <USABadge />
                    </div>
                  )}
                </div>

                <h3 className={`text-2xl font-bold ${colors.text}`}>
                  {product.name}
                </h3>
                <p className="text-gray-500 text-sm mt-1">{product.subtitle}</p>
                <p className="text-gray-300 mt-4 text-sm leading-relaxed flex-grow">
                  {product.description}
                </p>

                {/* Features list */}
                <ul className="mt-6 space-y-2">
                  {product.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-gray-400"
                    >
                      <span className={`${colors.text}`}>&#10003;</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Price + CTA */}
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-3xl font-black text-white">
                    ${product.price}
                  </span>
                  <motion.button
                    className={`${
                      product.popular
                        ? "bg-purple text-black"
                        : `border ${colors.border} ${colors.text}`
                    } px-6 py-2.5 rounded-full text-sm font-bold cursor-pointer`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      addItem({
                        id: product.id,
                        name: product.name,
                        subtitle: product.subtitle,
                        price: product.price,
                        priceCents: product.priceCents,
                        image: product.image,
                      })
                    }
                  >
                    Add to Cart
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

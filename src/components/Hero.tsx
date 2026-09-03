"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
  // Backdrop moves less than the copy (classic parallax) and eases in
  // slightly so the edges never expose the page background.
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.16]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Launch-night photo backdrop. Drifts slightly slower than the copy
          for depth. Overlaid twice — a flat scrim for contrast, then a
          bottom-up gradient so the headline never sits on busy grass. */}
      <motion.div className="absolute inset-0" style={{ y: bgY, scale: bgScale }}>
        <img
          src="/photos/hero-field-1600.webp"
          srcSet="/photos/hero-field-900.webp 900w, /photos/hero-field-1600.webp 1600w, /photos/hero-field-2400.webp 2400w"
          sizes="100vw"
          alt="A field full of people in the middle of a slime war"
          className="w-full h-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>
      {/* One flat scrim for text contrast, plus a bottom-only fade that
          hands off into the next section. Keep these light — stacking a
          full-strength gradient on top of the scrim blacks the photo out. */}
      <div className="absolute inset-0 bg-black/45" />
      {/* Centre vignette: buys contrast under the copy block without
          flattening the whole photo the way a heavier flat scrim would. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55)_0%,transparent_65%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

      {/* Animated background blobs */}
      <div className="absolute inset-0 opacity-60">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-lime/20 rounded-full blur-3xl"
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -30, 50, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple/20 rounded-full blur-3xl"
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 40, -20, 0],
            scale: [1, 0.9, 1.3, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink/15 rounded-full blur-3xl"
          animate={{
            x: [0, 60, -40, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan/15 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 50, 0],
            y: [0, 30, -40, 0],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        style={{ y, opacity, scale }}
        className="relative z-10 text-center px-6 max-w-5xl mx-auto"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="inline-flex items-center gap-2 bg-lime/10 border border-lime/30 rounded-full px-4 py-1.5 mb-8"
        >
          <span className="w-2 h-2 bg-lime rounded-full animate-pulse" />
          <span className="text-lime text-sm font-medium">Just Add Water</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none mb-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 50 }}
        >
          <span className="text-white">Make </span>
          <motion.span
            className="text-lime inline-block"
            animate={{ rotate: [0, -3, 3, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            Slime
          </motion.span>
          <br />
          <span className="text-white">Like a </span>
          <motion.span
            className="bg-gradient-to-r from-purple via-pink to-cyan bg-clip-text text-transparent inline-block"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            Pro
          </motion.span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto mb-10 [text-shadow:0_1px_12px_rgba(0,0,0,0.9)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          Premium slime powder kits that make{" "}
          <span className="text-white font-semibold">5 gallons of slime</span>{" "}
          per pouch. Perfect for youth groups, events, parties, and content
          creators.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring" }}
        >
          <motion.a
            href="#products"
            className="bg-lime text-black px-8 py-4 rounded-full text-lg font-bold inline-flex items-center justify-center gap-2"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 40px rgba(163, 230, 53, 0.3)",
            }}
            whileTap={{ scale: 0.95 }}
          >
            Shop Kits
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              &rarr;
            </motion.span>
          </motion.a>
          <motion.a
            href="#how-it-works"
            className="border border-white/20 text-white px-8 py-4 rounded-full text-lg font-medium inline-flex items-center justify-center hover:bg-white/5 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            How It Works
          </motion.a>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {[
            { value: "5 Gal", label: "Per Pouch" },
            { value: "4", label: "Colors" },
            { value: "< 5 min", label: "Setup Time" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="text-center"
              whileHover={{ scale: 1.1 }}
            >
              <div className="text-2xl sm:text-3xl font-black text-lime">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-gray-300 mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
          <motion.div
            className="w-1.5 h-1.5 bg-lime rounded-full"
            animate={{ y: [0, 16, 0], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}

"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Pour Into Bucket",
    description:
      "Tear open a pouch and dump the powder into any standard 5-gallon bucket. One pouch = one bucket = 5 gallons of slime.",
    icon: "🪣",
  },
  {
    number: "02",
    title: "Add Water & Mix",
    description:
      "Fill the bucket with water and stir with a mixing paddle or your hands. Watch it transform in seconds.",
    icon: "💧",
  },
  {
    number: "03",
    title: "Go Absolutely Wild",
    description:
      "Fill up sprayers, grab buckets, and let chaos reign. Perfect for slime wars, obstacle courses, and content creation.",
    icon: "🎉",
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="how-it-works"
      className="py-32 px-6 relative overflow-hidden"
      ref={ref}
    >
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-lime/5 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 50 }}
        >
          <span className="text-lime text-sm font-bold tracking-widest uppercase">
            Dead Simple
          </span>
          <h2 className="text-4xl sm:text-6xl font-black mt-4 mb-6">
            How It <span className="text-lime">Works</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            From bag to slime war in under 5 minutes. Just powder and water.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <motion.div
            className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-lime/50 via-purple/50 to-pink/50"
            initial={{ scaleY: 0 }}
            animate={isInView ? { scaleY: 1 } : {}}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
          />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                className={`flex flex-col md:flex-row items-center gap-8 ${
                  i % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
                initial={{ opacity: 0, x: i % 2 === 0 ? -60 : 60 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{
                  delay: 0.2 + i * 0.2,
                  type: "spring",
                  stiffness: 50,
                }}
              >
                {/* Content */}
                <div
                  className={`flex-1 ${
                    i % 2 === 1 ? "md:text-right" : ""
                  }`}
                >
                  <span className="text-6xl font-black text-white/5">
                    {step.number}
                  </span>
                  <h3 className="text-2xl font-bold text-white -mt-6">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 mt-3 leading-relaxed max-w-sm">
                    {step.description}
                  </p>
                </div>

                {/* Center icon */}
                <motion.div
                  className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-3xl shrink-0"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {step.icon}
                </motion.div>

                {/* Spacer for alignment */}
                <div className="flex-1 hidden md:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

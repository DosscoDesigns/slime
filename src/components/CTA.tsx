"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-32 px-6 relative overflow-hidden" ref={ref}>
      {/* Background effects */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-lime/10 via-purple/10 to-pink/10"
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-0 left-1/4 w-96 h-96 bg-lime/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="max-w-4xl mx-auto relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 50 }}
        >
          <h2 className="text-4xl sm:text-6xl font-black mb-6">
            Ready to Get{" "}
            <motion.span
              className="text-lime inline-block"
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              Slimed?
            </motion.span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            Order your kit today and have everything you need for an epic slime
            experience delivered to your door.
          </p>

          <motion.a
            href="#products"
            className="inline-flex items-center gap-3 bg-lime text-black px-10 py-5 rounded-full text-xl font-bold"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 60px rgba(163, 230, 53, 0.3)",
            }}
            whileTap={{ scale: 0.95 }}
          >
            Shop Now
            <motion.span
              animate={{ x: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              &rarr;
            </motion.span>
          </motion.a>

          <p className="text-gray-600 text-sm mt-6">
            Free shipping on orders over $50
          </p>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export default function SuccessPage() {
  const { clearCart } = useCart();

  // Clear cart on successful payment
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        className="text-center max-w-lg"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 50 }}
      >
        {/* Animated checkmark */}
        <motion.div
          className="w-24 h-24 rounded-full bg-lime/10 border-2 border-lime flex items-center justify-center mx-auto mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <motion.svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-lime"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            />
          </motion.svg>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl font-black text-white mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Order <span className="text-lime">Confirmed!</span>
        </motion.h1>

        <motion.p
          className="text-gray-400 text-lg mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Your slime kit is on its way. Get those buckets ready — it&apos;s about
          to get messy.
        </motion.p>

        <motion.p
          className="text-gray-500 text-sm mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          A confirmation email has been sent. You&apos;ll receive tracking info
          once your order ships.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring" }}
        >
          <motion.a
            href="/"
            className="bg-lime text-black px-8 py-3 rounded-full font-bold inline-flex items-center justify-center"
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(163, 230, 53, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            Back to Home
          </motion.a>
          <motion.a
            href="/#products"
            className="border border-white/20 text-white px-8 py-3 rounded-full font-medium inline-flex items-center justify-center hover:bg-white/5 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Order More
          </motion.a>
        </motion.div>

        {/* Confetti-like floating elements */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full pointer-events-none"
            style={{
              background: ["#a3e635", "#c084fc", "#f472b6", "#22d3ee", "#a3e635", "#c084fc"][i],
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 20}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

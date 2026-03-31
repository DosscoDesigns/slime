"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "./CartProvider";
import { useState } from "react";

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">
                Cart{" "}
                {totalItems > 0 && (
                  <span className="text-lime text-sm font-normal">
                    ({totalItems} {totalItems === 1 ? "item" : "items"})
                  </span>
                )}
              </h2>
              <motion.button
                className="text-gray-400 hover:text-white p-2"
                onClick={() => setIsOpen(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close cart"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <span className="text-4xl mb-4">🪣</span>
                  <p className="text-lg font-medium">Your cart is empty</p>
                  <p className="text-sm mt-2">Add some slime kits to get started!</p>
                  <motion.button
                    className="mt-6 text-lime text-sm font-medium hover:underline"
                    onClick={() => setIsOpen(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    Continue Shopping
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                        className="flex gap-4"
                      >
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm truncate">
                            {item.name}
                          </h3>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {item.subtitle}
                          </p>
                          <p className="text-lime font-bold mt-1">
                            ${item.price}
                          </p>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-3 mt-2">
                            <motion.button
                              className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 text-sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              whileTap={{ scale: 0.85 }}
                            >
                              &minus;
                            </motion.button>
                            <span className="text-white text-sm font-medium w-4 text-center">
                              {item.quantity}
                            </span>
                            <motion.button
                              className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 text-sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              whileTap={{ scale: 0.85 }}
                            >
                              +
                            </motion.button>
                            <motion.button
                              className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                              onClick={() => removeItem(item.id)}
                              whileTap={{ scale: 0.85 }}
                              aria-label={`Remove ${item.name}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              </svg>
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Clear cart */}
                  <motion.button
                    className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                    onClick={clearCart}
                    whileTap={{ scale: 0.95 }}
                  >
                    Clear cart
                  </motion.button>
                </div>
              )}
            </div>

            {/* Footer / Checkout */}
            {items.length > 0 && (
              <motion.div
                className="border-t border-white/10 p-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white text-xl font-bold">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-gray-600 text-xs">
                  Shipping & taxes calculated at checkout
                </p>
                <motion.button
                  className="w-full bg-lime text-black py-4 rounded-full font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCheckout}
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.02, boxShadow: "0 0 30px rgba(163, 230, 53, 0.3)" }}
                  whileTap={loading ? {} : { scale: 0.98 }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full inline-block"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Processing...
                    </span>
                  ) : (
                    "Checkout"
                  )}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

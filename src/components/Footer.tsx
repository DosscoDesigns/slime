"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type ModalType = "shipping" | "privacy" | "terms" | null;

function PolicyModal({
  type,
  onClose,
}: {
  type: ModalType;
  onClose: () => void;
}) {
  if (!type) return null;

  const content: Record<
    "shipping" | "privacy" | "terms",
    { title: string; body: React.ReactNode }
  > = {
    shipping: {
      title: "Shipping & Returns",
      body: (
        <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
          <h3 className="text-white font-semibold text-base">Shipping</h3>
          <p>
            We ship all orders within the United States via USPS or UPS.
            Orders are processed within 1–3 business days. Standard shipping
            typically arrives in 5–7 business days. Expedited options may be
            available at checkout.
          </p>
          <p>
            You&apos;ll receive a tracking number via email once your order
            ships. If you don&apos;t see it, check your spam folder or reach
            out to us.
          </p>
          <h3 className="text-white font-semibold text-base mt-6">Returns</h3>
          <p>
            We want you to love your slime. If your order arrives damaged or
            you received the wrong item, contact us within 14 days and
            we&apos;ll make it right — replacement or full refund, your call.
          </p>
          <p>
            Unopened kits in original packaging may be returned within 30
            days for a full refund. Return shipping is on us for damaged or
            incorrect orders. For change-of-mind returns, the buyer covers
            return shipping.
          </p>
          <p>
            Due to the nature of the product, we cannot accept returns on
            opened powder pouches.
          </p>
        </div>
      ),
    },
    privacy: {
      title: "Privacy Policy",
      body: (
        <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
          <p>
            <span className="text-white font-semibold">What we collect:</span>{" "}
            When you place an order, we collect your name, email, shipping
            address, and payment information. Payment is processed securely
            by Stripe — we never see or store your card number.
          </p>
          <p>
            <span className="text-white font-semibold">How we use it:</span>{" "}
            Your information is used solely to fulfill your order, send
            shipping updates, and communicate about your purchase. We
            don&apos;t sell, rent, or share your personal information with
            third parties for marketing purposes.
          </p>
          <p>
            <span className="text-white font-semibold">Cookies:</span> We
            use essential cookies to keep your cart working. No tracking
            cookies, no ad pixels, no creepy stuff.
          </p>
          <p>
            <span className="text-white font-semibold">Questions?</span>{" "}
            Reach out to us anytime with privacy concerns.
          </p>
        </div>
      ),
    },
    terms: {
      title: "Terms of Service",
      body: (
        <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
          <p>
            By purchasing from The Slime Co, you agree to these terms.
          </p>
          <p>
            <span className="text-white font-semibold">Products:</span> Our
            slime powder is intended for outdoor recreational use. Follow
            the included instructions for best results. We recommend adult
            supervision for children under 12.
          </p>
          <p>
            <span className="text-white font-semibold">Pricing:</span> All
            prices are in USD. We reserve the right to adjust pricing at
            any time. Orders are charged at the price displayed at
            checkout.
          </p>
          <p>
            <span className="text-white font-semibold">Liability:</span>{" "}
            Our slime is non-toxic and safe when used as directed. The
            Slime Co is not responsible for staining, property damage, or
            any misuse of the product. Use outdoors on surfaces that can
            get messy. While our formula washes out of most clothing, we
            recommend wearing clothes you don&apos;t mind getting slimed.
          </p>
          <p>
            <span className="text-white font-semibold">
              Intellectual Property:
            </span>{" "}
            All content, branding, and product formulas are the property
            of The Slime Co. Don&apos;t copy our stuff.
          </p>
        </div>
      ),
    },
  };

  const { title, body } = content[type];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-4 inset-y-8 sm:inset-x-auto sm:inset-y-12 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg bg-zinc-950 border border-white/10 rounded-2xl z-[60] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <motion.button
            className="text-gray-400 hover:text-white p-1"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{body}</div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Footer() {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <footer className="border-t border-white/10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            {/* Brand */}
            <div>
              <motion.div
                className="text-2xl font-bold tracking-tight mb-4"
                whileHover={{ scale: 1.02 }}
              >
                <span className="text-lime">THE SLIME</span>{" "}
                <span className="text-white">CO</span>
              </motion.div>
              <p className="text-gray-500 max-w-sm text-sm">
                Premium slime powder kits that turn any event into an
                unforgettable experience. Just add water.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#products"
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    Shop Now
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Support</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setModal("shipping")}
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    Shipping & Returns
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:hello@theslimeco.com"
                    className="text-gray-500 hover:text-lime transition-colors text-sm"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-sm">
              &copy; {new Date().getFullYear()} The Slime Co. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              <button
                onClick={() => setModal("privacy")}
                className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
              >
                Privacy
              </button>
              <button
                onClick={() => setModal("terms")}
                className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
              >
                Terms
              </button>
            </div>
          </div>
        </div>
      </footer>

      <PolicyModal type={modal} onClose={() => setModal(null)} />
    </>
  );
}

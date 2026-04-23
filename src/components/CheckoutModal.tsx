"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, FormEvent } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  AddressElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCart, CartItem } from "./CartProvider";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// Dark appearance matching the site theme
const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary: "#a3e635",
    colorBackground: "#18181b",
    colorText: "#f5f5f5",
    colorDanger: "#ef4444",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      backgroundColor: "#27272a",
      border: "1px solid rgba(255,255,255,0.1)",
    },
    ".Input:focus": {
      border: "1px solid #a3e635",
      boxShadow: "0 0 0 1px #a3e635",
    },
    ".Label": {
      color: "#a1a1aa",
    },
    ".Tab": {
      backgroundColor: "#27272a",
      border: "1px solid rgba(255,255,255,0.1)",
    },
    ".Tab--selected": {
      backgroundColor: "#a3e635",
      color: "#000",
    },
  },
};

// Inner form component (needs to be inside Elements provider)
function CheckoutForm({
  onClose,
  total,
}: {
  onClose: () => void;
  total: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clearCart } = useCart();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Please check your payment details.");
      setLoading(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
      },
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed. Please try again.");
      setLoading(false);
    } else {
      clearCart();
      try { localStorage.removeItem("slimeco-cart"); } catch {}
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Payment
          </h3>
          <PaymentElement options={{ layout: "tabs" }} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Shipping Address
          </h3>
          <AddressElement
            options={{ mode: "shipping", allowedCountries: ["US"] }}
          />
        </div>

        {error && (
          <motion.p
            className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.p>
        )}
      </div>

      <div className="border-t border-white/10 p-5 space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="text-white text-xl font-bold">
            ${total.toFixed(2)}
          </span>
        </div>
        <motion.button
          type="submit"
          disabled={!stripe || loading}
          className="w-full bg-lime text-black py-3.5 rounded-full font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={
            loading ? {} : { scale: 1.02, boxShadow: "0 0 30px rgba(163, 230, 53, 0.3)" }
          }
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
            `Pay $${total.toFixed(2)}`
          )}
        </motion.button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Inner modal content — only mounted when open, so fetch fires immediately
function CheckoutModalContent({ onClose }: { onClose: () => void }) {
  const { items, totalPrice } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const initCheckout = useCallback(async () => {
    setFetchError(null);
    setFetching(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i: CartItem) => ({
            id: i.id,
            quantity: i.quantity,
            name: i.name,
            subtitle: i.subtitle,
            priceCents: i.priceCents,
            gallons: i.gallons,
            color: i.color,
            addons: i.addons,
          })),
        }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setFetchError(data.error || "Failed to initialize checkout.");
      }
    } catch {
      setFetchError("Failed to connect. Please try again.");
    } finally {
      setFetching(false);
    }
  }, [items]);

  // Fetch on first render of this component (which only mounts when modal opens)
  if (!clientSecret && !fetchError && !fetching) {
    initCheckout();
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed inset-x-4 inset-y-4 sm:inset-x-auto sm:inset-y-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md bg-zinc-950 border border-white/10 rounded-2xl z-[60] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-semibold text-white">Checkout</h2>
          <motion.button
            className="text-gray-400 hover:text-white p-1"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Close checkout"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>
        </div>

        {fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <motion.button
              className="text-lime text-sm font-medium hover:underline"
              onClick={initCheckout}
              whileTap={{ scale: 0.95 }}
            >
              Try again
            </motion.button>
          </div>
        ) : !clientSecret ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <motion.span
              className="w-8 h-8 border-2 border-lime/30 border-t-lime rounded-full inline-block"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance }}
          >
            <CheckoutForm onClose={onClose} total={totalPrice} />
          </Elements>
        )}
      </motion.div>
    </>
  );
}

// Outer wrapper — handles AnimatePresence, only mounts inner content when open
interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <CheckoutModalContent onClose={onClose} />}
    </AnimatePresence>
  );
}

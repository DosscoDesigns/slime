"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useRef, FormEvent } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  AddressElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCart, CartItem } from "./CartProvider";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

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
    ".Label": { color: "#a1a1aa" },
    ".Tab": {
      backgroundColor: "#27272a",
      border: "1px solid rgba(255,255,255,0.1)",
    },
    ".Tab--selected": { backgroundColor: "#a3e635", color: "#000" },
  },
};

interface Breakdown {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

function cartPayload(items: CartItem[]) {
  return items.map((i) => ({
    id: i.id,
    quantity: i.quantity,
    name: i.name,
    subtitle: i.subtitle,
    priceCents: i.priceCents,
    gallons: i.gallons,
    color: i.color,
    addons: i.addons,
  }));
}

function CheckoutForm({
  onClose,
  paymentIntentId,
  breakdown,
  setBreakdown,
}: {
  onClose: () => void;
  paymentIntentId: string | null;
  breakdown: Breakdown;
  setBreakdown: (b: Breakdown) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { items, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Recompute shipping + FL tax whenever the customer completes/edits their
  // shipping address. The server updates the PaymentIntent amount and returns
  // the fresh breakdown.
  const syncAmount = useCallback(
    async (country?: string, state?: string) => {
      if (!paymentIntentId) return;
      setUpdating(true);
      try {
        const res = await fetch("/api/checkout/update-amount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            items: cartPayload(items),
            country,
            state,
          }),
        });
        if (res.ok) setBreakdown((await res.json()) as Breakdown);
      } catch {
        // keep last known totals
      } finally {
        setUpdating(false);
      }
    },
    [paymentIntentId, items, setBreakdown]
  );

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

    // Final amount sync from the entered address so the charged total matches
    // the displayed total (covers the case where the address changed but the
    // onChange update hadn't completed).
    const addressEl = elements.getElement(AddressElement);
    if (addressEl) {
      const { complete, value } = await addressEl.getValue();
      if (complete) {
        await syncAmount(value.address.country, value.address.state);
      }
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      // No receipt_email — the LinkAuthentication element attaches the email
      // to billing_details, and our Mailgun webhook is the sole sender (this
      // avoids a duplicate Stripe auto-receipt).
      confirmParams: { return_url: `${window.location.origin}/success` },
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed. Please try again.");
      setLoading(false);
    } else {
      clearCart();
      try {
        localStorage.removeItem("slimeco-cart");
      } catch {}
    }
  }

  const total = breakdown.totalCents || breakdown.subtotalCents;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
          <LinkAuthenticationElement />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Shipping Address</h3>
          <AddressElement
            options={{ mode: "shipping", allowedCountries: ["US"] }}
            onChange={(e) => {
              if (e.complete) {
                syncAmount(e.value.address.country, e.value.address.state);
              }
            }}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment</h3>
          <PaymentElement options={{ layout: "tabs" }} />
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
      <div className="border-t border-white/10 p-5 space-y-2 shrink-0">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Subtotal</span>
          <span>{money(breakdown.subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>Shipping</span>
          {breakdown.shippingCents === 0 ? (
            <span className="text-lime font-semibold">Free</span>
          ) : (
            <span>{money(breakdown.shippingCents)}</span>
          )}
        </div>
        {(breakdown.taxCents > 0 || updating) && (
          <div className="flex justify-between text-sm text-gray-400">
            <span>FL sales tax (7.5%)</span>
            {updating ? (
              <span className="italic opacity-60">updating…</span>
            ) : (
              <span>{money(breakdown.taxCents)}</span>
            )}
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="text-white text-xl font-bold">{money(total)}</span>
        </div>
        <motion.button
          type="submit"
          disabled={!stripe || loading || updating}
          className="w-full bg-lime text-black py-3.5 rounded-full font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed mt-1"
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
            `Pay ${money(total)}`
          )}
        </motion.button>
        <button type="button" onClick={onClose} className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CheckoutModalContent({ onClose }: { onClose: () => void }) {
  const { items } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown>({
    subtotalCents: 0,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 0,
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchedRef = useRef<boolean | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartPayload(items) }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId ?? null);
        setBreakdown({
          subtotalCents: data.subtotalCents ?? 0,
          shippingCents: data.shippingCents ?? 0,
          taxCents: data.taxCents ?? 0,
          totalCents: data.totalCents ?? 0,
        });
      } else {
        setFetchError(data.error || "Failed to initialize checkout.");
      }
    } catch {
      setFetchError("Failed to connect. Please try again.");
    }
  }, [items]);

  // Fire fetch once on mount — no synchronous setState during render,
  // all setState calls happen asynchronously after the await
  if (fetchedRef.current === null) {
    fetchedRef.current = true;
    doFetch();
  }

  function handleRetry() {
    setFetchError(null);
    setClientSecret(null);
    doFetch();
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
          <motion.button className="text-gray-400 hover:text-white p-1" onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} aria-label="Close checkout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </motion.button>
        </div>

        {fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-red-400 text-sm mb-4">{fetchError}</p>
            <motion.button className="text-lime text-sm font-medium hover:underline" onClick={handleRetry} whileTap={{ scale: 0.95 }}>
              Try again
            </motion.button>
          </div>
        ) : !clientSecret ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <motion.span className="w-8 h-8 border-2 border-lime/30 border-t-lime rounded-full inline-block" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CheckoutForm
              onClose={onClose}
              paymentIntentId={paymentIntentId}
              breakdown={breakdown}
              setBreakdown={setBreakdown}
            />
          </Elements>
        )}
      </motion.div>
    </>
  );
}

interface CheckoutModalProps { isOpen: boolean; onClose: () => void }

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && <CheckoutModalContent onClose={onClose} />}
    </AnimatePresence>
  );
}

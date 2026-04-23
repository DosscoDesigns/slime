"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import { useCart, KitAddon } from "./CartProvider";

// --- Data ---

export type SlimeColor = "red" | "green" | "blue" | "yellow";
type ColorOption = SlimeColor | "one-of-each";

const COLORS: { id: ColorOption; label: string; hex: string }[] = [
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "one-of-each", label: "One of Each", hex: "" },
];

interface AddonDef {
  id: string;
  name: string;
  description: string;
  retailPrice: number; // "regular" price
  retailPriceCents: number;
  kitPrice: number; // discounted kit price
  kitPriceCents: number;
  icon: string;
  suggestedPer20: number;
}

const ADDON_DEFS: AddonDef[] = [
  {
    id: "buckets",
    name: "5-Gallon Buckets",
    description: "Mix your slime right in the bucket",
    retailPrice: 8,
    retailPriceCents: 800,
    kitPrice: 4,
    kitPriceCents: 400,
    icon: "🪣",
    suggestedPer20: 4,
  },
  {
    id: "sprayers",
    name: "Pump Sprayers",
    description: "Maximum slime coverage",
    retailPrice: 5,
    retailPriceCents: 500,
    kitPrice: 3,
    kitPriceCents: 300,
    icon: "🔫",
    suggestedPer20: 12,
  },
  {
    id: "mixer",
    name: "Mixing Paddle",
    description: "Attach to any drill for easy mixing",
    retailPrice: 12,
    retailPriceCents: 1200,
    kitPrice: 8,
    kitPriceCents: 800,
    icon: "🔧",
    suggestedPer20: 1,
  },
  {
    id: "goggles",
    name: "Safety Goggles",
    description: "Keep the slime out of your eyes",
    retailPrice: 4,
    retailPriceCents: 400,
    kitPrice: 2,
    kitPriceCents: 200,
    icon: "🥽",
    suggestedPer20: 10,
  },
];

export interface KitTier {
  gallons: number;
  name: string;
  tagline: string;
  basePrice: number;
  basePriceCents: number;
  color: "lime" | "purple" | "pink";
  popular?: boolean;
}

export const KIT_TIERS: KitTier[] = [
  {
    gallons: 20,
    name: "Backyard Bash",
    tagline: "Perfect for 10–25 people",
    basePrice: 15,
    basePriceCents: 1500,
    color: "lime",
  },
  {
    gallons: 40,
    name: "Block Party",
    tagline: "Great for 25–50 people",
    basePrice: 28,
    basePriceCents: 2800,
    color: "purple",
    popular: true,
  },
  {
    gallons: 80,
    name: "Total Mayhem",
    tagline: "Built for 50–100+ people",
    basePrice: 50,
    basePriceCents: 5000,
    color: "pink",
  },
];

// --- Helpers ---

function suggestedQty(addon: AddonDef, gallons: number): number {
  return Math.round(addon.suggestedPer20 * (gallons / 20));
}

// --- Component ---

interface KitWizardProps {
  tier: KitTier | null;
  onClose: () => void;
}

const STEPS = ["Color", "Add-ons", "Review"] as const;
type Step = (typeof STEPS)[number];

export default function KitWizard({ tier, onClose }: KitWizardProps) {
  const { addItem } = useCart();
  const [step, setStep] = useState<Step>("Color");
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null);
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    ADDON_DEFS.forEach((a) => {
      initial[a.id] = 0;
    });
    return initial;
  });
  const [direction, setDirection] = useState(1);

  const stepIndex = STEPS.indexOf(step);

  const goToStep = useCallback((target: Step) => {
    const from = STEPS.indexOf(step);
    const to = STEPS.indexOf(target);
    setDirection(to > from ? 1 : -1);
    setStep(target);
  }, [step]);

  const goNext = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) {
      setDirection(1);
      setStep(STEPS[i + 1]);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i > 0) {
      setDirection(-1);
      setStep(STEPS[i - 1]);
    }
  }, [step]);

  // Auto-advance when color is selected
  const handleColorSelect = useCallback((color: ColorOption) => {
    setSelectedColor(color);
    // Small delay so user sees their selection before advancing
    setTimeout(() => {
      setDirection(1);
      setStep("Add-ons");
    }, 350);
  }, []);

  // Toggle addon: add suggested qty or remove entirely
  const toggleAddon = useCallback((addon: AddonDef) => {
    if (!tier) return;
    setAddonQtys((prev) => {
      const current = prev[addon.id] || 0;
      if (current > 0) {
        return { ...prev, [addon.id]: 0 };
      }
      return { ...prev, [addon.id]: suggestedQty(addon, tier.gallons) };
    });
  }, [tier]);

  // Pricing
  const addonTotal = useMemo(() => {
    return ADDON_DEFS.reduce((sum, a) => sum + a.kitPrice * (addonQtys[a.id] || 0), 0);
  }, [addonQtys]);

  const addonTotalCents = useMemo(() => {
    return ADDON_DEFS.reduce((sum, a) => sum + a.kitPriceCents * (addonQtys[a.id] || 0), 0);
  }, [addonQtys]);

  const totalPrice = (tier?.basePrice ?? 0) + addonTotal;
  const totalPriceCents = (tier?.basePriceCents ?? 0) + addonTotalCents;

  // Color display
  const colorLabel =
    selectedColor === "one-of-each"
      ? "One of Each (R/G/B/Y)"
      : COLORS.find((c) => c.id === selectedColor)?.label ?? "";

  function handleAddToCart() {
    if (!tier || !selectedColor) return;

    const addons: KitAddon[] = ADDON_DEFS.filter((a) => (addonQtys[a.id] || 0) > 0).map((a) => ({
      id: a.id,
      name: a.name,
      price: a.kitPrice,
      priceCents: a.kitPriceCents,
      quantity: addonQtys[a.id],
    }));

    const kitId = `kit-${tier.gallons}g-${selectedColor}-${Date.now()}`;

    addItem({
      id: kitId,
      name: `${tier.name} Kit — ${tier.gallons}G`,
      subtitle: `${colorLabel}${addons.length > 0 ? ` + ${addons.length} add-on${addons.length > 1 ? "s" : ""}` : ""}`,
      price: totalPrice,
      priceCents: totalPriceCents,
      image: "",
      gallons: tier.gallons,
      color: selectedColor,
      addons,
    });

    onClose();
  }

  if (!tier) return null;

  const canAdvance = step === "Color" ? selectedColor !== null : true;

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {tier && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-zinc-950 border-l border-white/10 z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{tier.name}</h2>
                  <p className="text-gray-500 text-sm">{tier.gallons} Gallons — {tier.tagline}</p>
                </div>
                <motion.button
                  className="text-gray-400 hover:text-white p-2"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Close wizard"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() => {
                        if (i < stepIndex) goToStep(STEPS[i]);
                      }}
                      className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                        i <= stepIndex
                          ? "text-lime cursor-pointer"
                          : "text-gray-600 cursor-default"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                          i < stepIndex
                            ? "bg-lime text-black border-lime"
                            : i === stepIndex
                              ? "border-lime text-lime"
                              : "border-gray-700 text-gray-700"
                        }`}
                      >
                        {i < stepIndex ? "✓" : i + 1}
                      </span>
                      <span className="hidden sm:inline">{s}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-px transition-colors ${
                          i < stepIndex ? "bg-lime/50" : "bg-gray-800"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto relative">
              <AnimatePresence mode="wait" custom={direction}>
                {step === "Color" && (
                  <motion.div
                    key="color"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    <h3 className="text-lg font-bold text-white mb-2">Choose Your Color</h3>
                    <p className="text-gray-500 text-sm mb-4">
                      Pick a single color or get one of each.
                    </p>

                    {/* Compact color grid — 5 items in a tight 3+2 layout, no scroll */}
                    <div className="grid grid-cols-4 gap-2">
                      {COLORS.filter((c) => c.id !== "one-of-each").map((c) => {
                        const selected = selectedColor === c.id;
                        return (
                          <motion.button
                            key={c.id}
                            className={`relative rounded-xl border-2 p-3 text-center transition-colors ${
                              selected
                                ? "border-lime bg-lime/10"
                                : "border-white/10 bg-white/5 hover:border-white/20"
                            }`}
                            onClick={() => handleColorSelect(c.id)}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <div
                              className="w-10 h-10 rounded-lg mx-auto mb-2"
                              style={{ background: c.hex }}
                            />
                            <span className="text-xs font-semibold text-white">
                              {c.label}
                            </span>
                            {selected && (
                              <motion.div
                                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-lime flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400 }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* "One of Each" as full-width option below */}
                    <motion.button
                      className={`relative w-full rounded-xl border-2 p-3 mt-2 flex items-center gap-3 transition-colors ${
                        selectedColor === "one-of-each"
                          ? "border-lime bg-lime/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                      onClick={() => handleColorSelect("one-of-each")}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="w-10 h-10 rounded-lg flex overflow-hidden shrink-0">
                        <div className="flex-1" style={{ background: "#ef4444" }} />
                        <div className="flex-1" style={{ background: "#22c55e" }} />
                        <div className="flex-1" style={{ background: "#3b82f6" }} />
                        <div className="flex-1" style={{ background: "#eab308" }} />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-white">One of Each</span>
                        <span className="block text-xs text-gray-500">Equal parts R/G/B/Y</span>
                      </div>
                      {selectedColor === "one-of-each" && (
                        <motion.div
                          className="absolute top-1/2 -translate-y-1/2 right-3 w-5 h-5 rounded-full bg-lime flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  </motion.div>
                )}

                {step === "Add-ons" && (
                  <motion.div
                    key="addons"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    <h3 className="text-lg font-bold text-white mb-2">Add Supplies</h3>
                    <p className="text-gray-500 text-sm mb-4">
                      Kit pricing — save on every add-on. Suggested qty for {tier.gallons} gallons.
                    </p>

                    <div className="space-y-3">
                      {ADDON_DEFS.map((addon) => {
                        const qty = addonQtys[addon.id] || 0;
                        const inKit = qty > 0;
                        const suggested = suggestedQty(addon, tier.gallons);
                        return (
                          <motion.div
                            key={addon.id}
                            className={`rounded-2xl border p-4 transition-colors ${
                              inKit
                                ? "border-lime/30 bg-lime/5"
                                : "border-white/10 bg-white/5"
                            }`}
                            layout
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl shrink-0">{addon.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-white font-semibold text-sm">
                                    {addon.name}
                                  </h4>
                                  <span className="text-gray-600 line-through text-xs">
                                    ${addon.retailPrice}
                                  </span>
                                  <span className="text-lime text-sm font-bold">
                                    ${addon.kitPrice}/ea
                                  </span>
                                </div>
                                <p className="text-gray-500 text-xs">
                                  {addon.description}
                                </p>
                              </div>
                              <motion.button
                                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                  inKit
                                    ? "bg-white/10 text-red-400 hover:bg-red-500/20"
                                    : "bg-lime text-black hover:bg-lime-dark"
                                }`}
                                onClick={() => toggleAddon(addon)}
                                whileTap={{ scale: 0.95 }}
                              >
                                {inKit ? "Remove" : "Add to Kit"}
                              </motion.button>
                            </div>

                            {/* Quantity adjuster — only shown when in kit */}
                            <AnimatePresence>
                              {inKit && (
                                <motion.div
                                  className="flex items-center gap-3 mt-3 ml-9"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <span className="text-gray-500 text-xs">Qty:</span>
                                  <motion.button
                                    className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 text-sm"
                                    onClick={() =>
                                      setAddonQtys((p) => ({
                                        ...p,
                                        [addon.id]: Math.max(1, (p[addon.id] || 0) - 1),
                                      }))
                                    }
                                    whileTap={{ scale: 0.85 }}
                                  >
                                    &minus;
                                  </motion.button>
                                  <span className="text-white text-sm font-medium w-5 text-center">
                                    {qty}
                                  </span>
                                  <motion.button
                                    className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 text-sm"
                                    onClick={() =>
                                      setAddonQtys((p) => ({
                                        ...p,
                                        [addon.id]: (p[addon.id] || 0) + 1,
                                      }))
                                    }
                                    whileTap={{ scale: 0.85 }}
                                  >
                                    +
                                  </motion.button>
                                  {qty !== suggested && (
                                    <button
                                      className="text-xs text-lime/60 hover:text-lime ml-auto"
                                      onClick={() =>
                                        setAddonQtys((p) => ({
                                          ...p,
                                          [addon.id]: suggested,
                                        }))
                                      }
                                    >
                                      Suggested: {suggested}
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {step === "Review" && (
                  <motion.div
                    key="review"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                    className="p-6"
                  >
                    <h3 className="text-lg font-bold text-white mb-6">Review Your Kit</h3>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                      {/* Base kit */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-white font-semibold">
                            {tier.name} — {tier.gallons}G Slime Powder
                          </h4>
                          <p className="text-gray-500 text-sm mt-0.5">
                            Color: {colorLabel}
                          </p>
                        </div>
                        <span className="text-white font-bold">
                          ${tier.basePrice.toFixed(2)}
                        </span>
                      </div>

                      {/* Add-ons */}
                      {ADDON_DEFS.some((a) => (addonQtys[a.id] || 0) > 0) && (
                        <>
                          <div className="border-t border-white/10" />
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                            Add-ons
                          </p>
                          {ADDON_DEFS.filter((a) => (addonQtys[a.id] || 0) > 0).map(
                            (addon) => {
                              const qty = addonQtys[addon.id];
                              return (
                                <div
                                  key={addon.id}
                                  className="flex justify-between items-center text-sm"
                                >
                                  <span className="text-gray-300">
                                    {addon.icon} {addon.name}{" "}
                                    <span className="text-gray-600">&times;{qty}</span>
                                  </span>
                                  <span className="text-gray-300">
                                    ${(addon.kitPrice * qty).toFixed(2)}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </>
                      )}

                      {/* Total */}
                      <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                        <span className="text-white font-bold text-lg">Total</span>
                        <span className="text-lime font-black text-2xl">
                          ${totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 p-6 space-y-3">
              {/* Total (shown on non-review steps) */}
              {step !== "Review" && (
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-400 font-semibold uppercase tracking-wider text-xs">Total</span>
                  <motion.span
                    className="text-lime font-bold text-lg"
                    key={`total-${totalPrice}-${step}`}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    ${totalPrice.toFixed(2)}
                  </motion.span>
                </div>
              )}

              <div className="flex gap-3">
                {stepIndex > 0 && (
                  <motion.button
                    className="flex-1 border border-white/20 text-white py-3 rounded-full font-bold text-sm hover:border-white/40 transition-colors"
                    onClick={goBack}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Back
                  </motion.button>
                )}
                {step === "Review" ? (
                  <motion.button
                    className="flex-1 bg-lime text-black py-3 rounded-full font-bold text-sm"
                    onClick={handleAddToCart}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 0 30px rgba(163, 230, 53, 0.3)",
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Add to Cart — ${totalPrice.toFixed(2)}
                  </motion.button>
                ) : (
                  <motion.button
                    className={`flex-1 py-3 rounded-full font-bold text-sm ${
                      canAdvance
                        ? "bg-lime text-black"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    }`}
                    onClick={canAdvance ? goNext : undefined}
                    whileHover={canAdvance ? { scale: 1.02 } : {}}
                    whileTap={canAdvance ? { scale: 0.98 } : {}}
                  >
                    {step === "Color" ? "Choose Add-ons" : "Review Kit"}
                  </motion.button>
                )}
              </div>

              {step === "Add-ons" && (
                <button
                  className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  onClick={goNext}
                >
                  Skip add-ons — just the slime
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

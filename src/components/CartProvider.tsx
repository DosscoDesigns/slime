"use client";

import { createContext, useContext, useState, useCallback, useMemo, useSyncExternalStore, ReactNode } from "react";
import { ADDONS_BY_ID, addonLineCents } from "@/lib/products";

/**
 * Sum add-on lines through the shared pricer so any quantity break is honoured
 * here exactly as the server honours it. Summing `priceCents * quantity`
 * instead would show a bulk-priced line at its undiscounted total while the
 * server charged the bundle price.
 */
function sumAddonCents(addons: KitAddon[]): number {
  return addons.reduce((s, a) => {
    const def = ADDONS_BY_ID[a.id];
    return s + (def ? addonLineCents(def, a.quantity) : a.priceCents * a.quantity);
  }, 0);
}

export interface KitAddon {
  id: string;
  name: string;
  price: number;
  priceCents: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  priceCents: number;
  image: string;
  quantity: number;
  gallons?: number;
  color?: string;
  addons?: KitAddon[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateAddonQuantity: (itemId: string, addonId: string, quantity: number) => void;
  removeAddon: (itemId: string, addonId: string) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "slimeco-cart";

// Custom event to notify subscribers of cart changes
const CART_CHANGE_EVENT = "slimeco-cart-change";

/**
 * Drop add-ons that no longer exist from a persisted cart, repricing the kit.
 *
 * Carts live in localStorage indefinitely, so a returning customer can be
 * holding an add-on we have since retired (buckets, dropped because they
 * cannot be shipped economically). priceKitCents() THROWS on an unknown
 * add-on, which would 400 their checkout and strand them with a cart they
 * cannot buy. Pruning on read is silent and safe: the line disappears and the
 * kit price drops accordingly.
 */
function pruneRetiredAddons(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    if (!item.addons?.length) return item;
    const kept = item.addons.filter((a) => ADDONS_BY_ID[a.id]);
    if (kept.length === item.addons.length) return item;
    const basePriceCents = item.priceCents - sumAddonCents(item.addons);
    const newPriceCents = basePriceCents + sumAddonCents(kept);
    return {
      ...item,
      addons: kept,
      price: newPriceCents / 100,
      priceCents: newPriceCents,
      subtitle:
        kept.length > 0
          ? `${item.subtitle.split(" +")[0]} + ${kept.length} add-on${kept.length > 1 ? "s" : ""}`
          : item.subtitle.split(" +")[0],
    };
  });
}

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? pruneRetiredAddons(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    // Dispatch custom event so useSyncExternalStore re-reads
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));
  } catch {
    // localStorage unavailable
  }
}

// Snapshot must return a stable reference for same data
let cachedSnapshot: string = "[]";
function getSnapshot(): string {
  try {
    const val = localStorage.getItem(CART_STORAGE_KEY) || "[]";
    if (val !== cachedSnapshot) cachedSnapshot = val;
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function subscribe(callback: () => void): () => void {
  // Listen for our own changes + cross-tab storage events
  window.addEventListener(CART_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const cartJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Prune here too, not just in readCart(): the rendered items come straight
  // from the localStorage snapshot, so a retired add-on would otherwise still
  // be displayed and still be posted to /api/checkout.
  const items: CartItem[] = useMemo(
    () => pruneRetiredAddons(JSON.parse(cartJson)),
    [cartJson]
  );

  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    const prev = readCart();
    const existing = prev.find((i) => i.id === item.id);
    if (existing) {
      writeCart(prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      writeCart([...prev, { ...item, quantity: 1 }]);
    }
    setIsOpen(true);
  }, [setIsOpen]);

  const removeItem = useCallback((id: string) => {
    writeCart(readCart().filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const prev = readCart();
    if (quantity <= 0) {
      writeCart(prev.filter((i) => i.id !== id));
    } else {
      writeCart(prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
    }
  }, []);

  const updateAddonQuantity = useCallback((itemId: string, addonId: string, quantity: number) => {
    writeCart(
      readCart().map((item) => {
        if (item.id !== itemId || !item.addons) return item;
        const newAddons = quantity <= 0
          ? item.addons.filter((a) => a.id !== addonId)
          : item.addons.map((a) => (a.id === addonId ? { ...a, quantity } : a));
        const oldAddonTotalCents = sumAddonCents(item.addons);
        const basePriceCents = item.priceCents - oldAddonTotalCents;
        const addonTotalCents = sumAddonCents(newAddons);
        const newPriceCents = basePriceCents + addonTotalCents;
        return {
          ...item,
          addons: newAddons,
          price: newPriceCents / 100,
          priceCents: newPriceCents,
          subtitle: newAddons.length > 0
            ? `${item.subtitle.split(" +")[0]} + ${newAddons.length} add-on${newAddons.length > 1 ? "s" : ""}`
            : item.subtitle.split(" +")[0],
        };
      })
    );
  }, []);

  const removeAddon = useCallback((itemId: string, addonId: string) => {
    updateAddonQuantity(itemId, addonId, 0);
  }, [updateAddonQuantity]);

  const clearCart = useCallback(() => {
    writeCart([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateAddonQuantity,
        removeAddon,
        clearCart,
        isOpen,
        setIsOpen,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

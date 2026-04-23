"use client";

import { createContext, useContext, useState, useCallback, useSyncExternalStore, ReactNode } from "react";

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

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
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
  const items: CartItem[] = JSON.parse(cartJson);

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
        const oldAddonTotal = item.addons.reduce((s, a) => s + a.price * a.quantity, 0);
        const oldAddonTotalCents = item.addons.reduce((s, a) => s + a.priceCents * a.quantity, 0);
        const basePrice = item.price - oldAddonTotal;
        const basePriceCents = item.priceCents - oldAddonTotalCents;
        const addonTotal = newAddons.reduce((s, a) => s + a.price * a.quantity, 0);
        const addonTotalCents = newAddons.reduce((s, a) => s + a.priceCents * a.quantity, 0);
        return {
          ...item,
          addons: newAddons,
          price: basePrice + addonTotal,
          priceCents: basePriceCents + addonTotalCents,
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

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

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
  price: number; // dollars (total for kit including add-ons)
  priceCents: number;
  image: string;
  quantity: number;
  // Kit-specific fields
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

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  // Persist on change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }, []);

  const updateAddonQuantity = useCallback((itemId: string, addonId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || !item.addons) return item;
        const newAddons = quantity <= 0
          ? item.addons.filter((a) => a.id !== addonId)
          : item.addons.map((a) => (a.id === addonId ? { ...a, quantity } : a));
        const addonTotal = newAddons.reduce((s, a) => s + a.price * a.quantity, 0);
        const addonTotalCents = newAddons.reduce((s, a) => s + a.priceCents * a.quantity, 0);
        // Base price = original price minus old addon total
        const oldAddonTotal = item.addons.reduce((s, a) => s + a.price * a.quantity, 0);
        const oldAddonTotalCents = item.addons.reduce((s, a) => s + a.priceCents * a.quantity, 0);
        const basePrice = item.price - oldAddonTotal;
        const basePriceCents = item.priceCents - oldAddonTotalCents;
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
    setItems([]);
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

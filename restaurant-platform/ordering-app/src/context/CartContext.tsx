import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Location, MenuItem } from "../lib/api";

export interface CartLine {
  item: MenuItem;
  quantity: number;
}

interface CartContextValue {
  location: Location | null;
  setLocation: (loc: Location | null) => void;
  lines: CartLine[];
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<Location | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  function setLocation(loc: Location | null) {
    // Si cambia de local, el carrito no tiene sentido (carta distinta)
    setLines([]);
    setLocationState(loc);
  }

  function addItem(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function removeItem(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId));
  }

  function setQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) return removeItem(itemId);
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity } : l)));
  }

  function clear() {
    setLines([]);
  }

  const totalItems = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const totalPrice = useMemo(() => lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0), [lines]);

  return (
    <CartContext.Provider
      value={{ location, setLocation, lines, addItem, removeItem, setQuantity, clear, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}

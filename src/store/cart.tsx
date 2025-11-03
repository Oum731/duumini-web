import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "../services/products";

export type CartLine = {
  id: number;                   // product.id
  name: string;
  price: number;
  cover?: string | null;
  product: Product;
  qty: number;
};

type CartState = {
  lines: CartLine[];
  add: (p: Product, qty?: number) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
};

const CartCtx = createContext<CartState | null>(null);
const LS_KEY = "duumini.cart.v1";

function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(Number(n || 0));
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // sécurité minimale
    return arr.filter((l) => typeof l?.id === "number" && typeof l?.qty === "number");
  } catch {
    return [];
  }
}

function save(lines: CartLine[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(lines));
    // notifier Navbar (si besoin)
    window.dispatchEvent(new CustomEvent("cart:changed"));
  } catch {}
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => load());

  useEffect(() => {
    save(lines);
  }, [lines]);

  const add = (p: Product, qty = 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(999, next[idx].qty + qty) };
        return next;
      }
      const cover = p.cover || p.images?.[0]?.url || null;
      return [...prev, { id: p.id, name: p.name, price: Number(p.price), cover, product: p, qty: Math.max(1, qty) }];
    });
  };

  const remove = (productId: number) => {
    setLines((prev) => prev.filter((l) => l.id !== productId));
  };

  const setQty = (productId: number, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === productId ? { ...l, qty: Math.max(0, Math.min(999, Math.floor(qty || 0))) } : l))
    );
  };

  const clear = () => setLines([]);

  const totalItems = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const totalAmount = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);

  const value: CartState = { lines, add, remove, setQty, clear, totalItems, totalAmount };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) {
    throw new Error("useCart must be used within <CartProvider>");
  }
  return ctx;
}

// Utilitaire affichage
export const mad = moneyMAD;

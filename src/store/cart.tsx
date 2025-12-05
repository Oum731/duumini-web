// src/store/cart.ts
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Product } from "../services/products";

export type CartLine = {
  id: number; // product.id
  name: string;
  price: number;
  cover?: string | null;
  product: Product;
  qty: number;

  // 🔹 pour les règles Food / resto
  shop_id?: number | null;
  sub_category?: string | null;
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
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(Number(n || 0));
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // sécurité minimale
    return arr.filter(
      (l) => typeof l?.id === "number" && typeof l?.qty === "number"
    );
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
    const anyP = p as any;
    const unitPrice = Number(
      anyP.price_client ?? anyP.price ?? anyP.client_price ?? 0
    );
    const cover = p.cover || p.images?.[0]?.url || null;
    const shopId =
      anyP.shop_id != null ? Number(anyP.shop_id) : null;
    const subCategory = anyP.sub_category ?? null;

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === p.id);

      // 🔹 Si la ligne existe déjà → on ajuste la quantité
      if (idx >= 0) {
        const next = [...prev];
        const current = next[idx];
        const newQty = Math.max(
          0,
          Math.min(999, current.qty + qty)
        );

        // quantité <= 0 → on retire la ligne
        if (newQty <= 0) {
          return next.filter((l) => l.id !== p.id);
        }

        next[idx] = { ...current, qty: newQty };
        return next;
      }

      // 🔹 Si la ligne n'existe pas encore
      if (qty <= 0) {
        // rien à ajouter si qty négative ou 0 sur un produit absent
        return prev;
      }

      const line: CartLine = {
        id: p.id,
        name: p.name,
        price: unitPrice,
        cover,
        product: p,
        qty: Math.max(1, Math.min(999, qty)),
        shop_id: shopId,
        sub_category: subCategory,
      };

      return [...prev, line];
    });
  };

  const remove = (productId: number) => {
    setLines((prev) => prev.filter((l) => l.id !== productId));
  };

  const setQty = (productId: number, qty: number) => {
    const normalized = Math.max(
      0,
      Math.min(999, Math.floor(qty || 0))
    );

    setLines((prev) => {
      // qty = 0 → on supprime la ligne
      if (normalized === 0) {
        return prev.filter((l) => l.id !== productId);
      }
      return prev.map((l) =>
        l.id === productId ? { ...l, qty: normalized } : l
      );
    });
  };

  const clear = () => setLines([]);

  const totalItems = useMemo(
    () => lines.reduce((s, l) => s + l.qty, 0),
    [lines]
  );
  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.price, 0),
    [lines]
  );

  const value: CartState = {
    lines,
    add,
    remove,
    setQty,
    clear,
    totalItems,
    totalAmount,
  };

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

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
  id: number;
  name: string;
  price: number;
  cover?: string | null;
  product: Product;
  qty: number;

  shop_id?: number | null;

  // ✅ Nouveau modèle sub-category (plat)
  sub_category_id?: number | null;
  sub_category_slug?: string | null;
  sub_category_name?: string | null;

  // fallback si certains endpoints renvoient encore category_*
  category_id?: number | null;
  category_slug?: string | null;
  category_name?: string | null;
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
    window.dispatchEvent(new CustomEvent("cart:changed"));
  } catch {}
}

function pickSubCategoryFlat(p: any): {
  sub_category_id: number | null;
  sub_category_slug: string | null;
  sub_category_name: string | null;
  category_id: number | null;
  category_slug: string | null;
  category_name: string | null;
} {
  const sub_category_id =
    typeof p?.sub_category_id === "number" ? Number(p.sub_category_id) : null;

  const sub_category_slug =
    (typeof p?.sub_category_slug === "string" && p.sub_category_slug.trim()) ||
    null;

  const sub_category_name =
    (typeof p?.sub_category_name === "string" && p.sub_category_name.trim()) ||
    null;

  const category_id =
    typeof p?.category_id === "number" ? Number(p.category_id) : null;

  const category_slug =
    (typeof p?.category_slug === "string" && p.category_slug.trim()) || null;

  const category_name =
    (typeof p?.category_name === "string" && p.category_name.trim()) || null;

  // si sub_category_* absent, on garde au moins category_* (utile pour filtres / affichage)
  if (!sub_category_id && !sub_category_slug && !sub_category_name) {
    return {
      sub_category_id: null,
      sub_category_slug: category_slug,
      sub_category_name: category_name,
      category_id,
      category_slug,
      category_name,
    };
  }

  return {
    sub_category_id,
    sub_category_slug,
    sub_category_name,
    category_id,
    category_slug,
    category_name,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => load());

  useEffect(() => {
    save(lines);
  }, [lines]);

  const add = (p: Product, qty = 1) => {
    const anyP = p as any;

    const unitPrice = Number(anyP.price_client ?? anyP.price ?? anyP.client_price ?? 0);
    const cover = p.cover || p.images?.[0]?.url || null;

    const shopId = anyP.shop_id != null ? Number(anyP.shop_id) : null;

    const sc = pickSubCategoryFlat(anyP);

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === p.id);

      if (idx >= 0) {
        const next = [...prev];
        const current = next[idx];
        const newQty = Math.max(0, Math.min(999, current.qty + qty));

        if (newQty <= 0) return next.filter((l) => l.id !== p.id);

        next[idx] = {
          ...current,
          qty: newQty,

          // mettre à jour au cas où le produit change côté API
          name: p.name,
          price: unitPrice,
          cover,

          shop_id: shopId ?? current.shop_id ?? null,

          sub_category_id: sc.sub_category_id ?? current.sub_category_id ?? null,
          sub_category_slug: sc.sub_category_slug ?? current.sub_category_slug ?? null,
          sub_category_name: sc.sub_category_name ?? current.sub_category_name ?? null,

          category_id: sc.category_id ?? current.category_id ?? null,
          category_slug: sc.category_slug ?? current.category_slug ?? null,
          category_name: sc.category_name ?? current.category_name ?? null,

          product: p,
        };

        return next;
      }

      if (qty <= 0) return prev;

      const line: CartLine = {
        id: p.id,
        name: p.name,
        price: unitPrice,
        cover,
        product: p,
        qty: Math.max(1, Math.min(999, qty)),

        shop_id: shopId,

        sub_category_id: sc.sub_category_id,
        sub_category_slug: sc.sub_category_slug,
        sub_category_name: sc.sub_category_name,

        category_id: sc.category_id,
        category_slug: sc.category_slug,
        category_name: sc.category_name,
      };

      return [...prev, line];
    });
  };

  const remove = (productId: number) => {
    setLines((prev) => prev.filter((l) => l.id !== productId));
  };

  const setQty = (productId: number, qty: number) => {
    const normalized = Math.max(0, Math.min(999, Math.floor(qty || 0)));

    setLines((prev) => {
      if (normalized === 0) return prev.filter((l) => l.id !== productId);
      return prev.map((l) => (l.id === productId ? { ...l, qty: normalized } : l));
    });
  };

  const clear = () => setLines([]);

  const totalItems = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
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
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export const mad = moneyMAD;

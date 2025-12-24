// src/store/cart.ts
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "../services/products";

export type CartVariant = {
  variant_id: number | null;
  variant_key: string; // clé stable pour identifier la ligne
  label: string | null; // ex: "Taille: M • Couleur: Noir"
  price: number | null; // ✅ null si pas d'override (puis on calcule le prix unitaire)
};

export type CartLine = {
  line_id: string; // ✅ unique par produit+variante
  id: number; // product id (compat)
  name: string;
  price: number; // ✅ prix unitaire réellement utilisé
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

  // ✅ Variante
  variant?: CartVariant;
};

type AddMeta = {
  variant?: Partial<CartVariant> | null;
};

type CartState = {
  lines: CartLine[];
  add: (p: Product, qty?: number, meta?: AddMeta) => void;
  removeLine: (lineId: string) => void;
  removeProduct: (productId: number) => void;
  setQtyLine: (lineId: string, qty: number) => void;
  clear: () => void;

  totalItems: number;
  totalAmount: number;

  // helpers
  qtyForProduct: (productId: number) => number;
  qtyForProductVariant: (productId: number, variantKey: string) => number;
};

const CartCtx = createContext<CartState | null>(null);
const LS_KEY = "duumini.cart.v2"; // ✅ bump version

function moneyMAD(n?: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(Number(n || 0));
}

function makeLineId(productId: number, variantKey: string) {
  const key = String(variantKey || "default").trim() || "default";
  return `${Number(productId)}__${key}`;
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

    // ✅ normalise & migre au besoin (anciens paniers, variant manquant, line_id sans "__")
    const out: CartLine[] = [];

    for (const l of arr) {
      if (!l || typeof l !== "object") continue;
      const id = Number((l as any).id || 0);
      const qty = Number((l as any).qty || 0);
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;

      const vKey = String((l as any)?.variant?.variant_key || "default").trim() || "default";
      const line_id =
        typeof (l as any).line_id === "string" && (l as any).line_id.includes("__")
          ? String((l as any).line_id)
          : makeLineId(id, vKey);

      const price = Number((l as any).price ?? 0);
      const safePrice = Number.isFinite(price) ? price : 0;

      const variant_id_raw = (l as any)?.variant?.variant_id;
      const variant_id =
        variant_id_raw == null || String(variant_id_raw).trim() === "" ? null : Number(variant_id_raw);

      const variantPriceRaw = (l as any)?.variant?.price;
      const variantPrice =
        variantPriceRaw == null || variantPriceRaw === "" ? null : Number(variantPriceRaw);

      const variant: CartVariant = {
        variant_id: Number.isFinite(variant_id as any) ? variant_id : null,
        variant_key: vKey,
        label:
          (l as any)?.variant?.label != null
            ? String((l as any).variant.label || "").trim() || null
            : null,
        price: Number.isFinite(variantPrice as any) ? variantPrice : null,
      };

      out.push({
        ...(l as any),
        line_id,
        id,
        qty: Math.floor(qty),
        price: safePrice,
        variant,
      });
    }

    return out;
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
  const sub_category_id = typeof p?.sub_category_id === "number" ? Number(p.sub_category_id) : null;

  const sub_category_slug = (typeof p?.sub_category_slug === "string" && p.sub_category_slug.trim()) || null;

  const sub_category_name = (typeof p?.sub_category_name === "string" && p.sub_category_name.trim()) || null;

  const category_id = typeof p?.category_id === "number" ? Number(p.category_id) : null;

  const category_slug = (typeof p?.category_slug === "string" && p.category_slug.trim()) || null;

  const category_name = (typeof p?.category_name === "string" && p.category_name.trim()) || null;

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

function safeCover(anyP: any): string | null {
  const cover = anyP?.cover || anyP?.image || anyP?.images?.[0]?.url || anyP?.images?.[0] || null;
  return cover ? String(cover) : null;
}

function normalizeVariant(meta?: AddMeta | null): CartVariant {
  const v = meta?.variant || null;

  const variant_id =
    v?.variant_id != null && String(v.variant_id).trim() !== "" ? Number(v.variant_id) : null;

  const variant_key =
    String(v?.variant_key || (variant_id != null ? `id:${variant_id}` : "default")).trim() || "default";

  const label = v?.label != null ? String(v.label || "").trim() || null : null;

  const priceRaw = (v as any)?.price;
  const price = priceRaw == null || priceRaw === "" ? null : Number(priceRaw);

  return {
    variant_id: Number.isFinite(variant_id as any) ? variant_id : null,
    variant_key,
    label,
    price: Number.isFinite(price as any) ? price : null,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => load());

  useEffect(() => {
    save(lines);
  }, [lines]);

  const add = (p: Product, qty = 1, meta?: AddMeta) => {
    const anyP = p as any;

    const baseUnitPrice = Number(anyP.price_client ?? anyP.client_price ?? anyP.price ?? 0);
    const cover = safeCover(anyP);

    const shopId = anyP.shop_id != null ? Number(anyP.shop_id) : null;
    const sc = pickSubCategoryFlat(anyP);

    // ✅ variante
    const v = normalizeVariant(meta);

    // ✅ prix unitaire: override si fourni, sinon prix produit
    const unitPrice = v.price != null ? Number(v.price) : Number(baseUnitPrice || 0);

    const lineId = makeLineId(Number(p.id), v.variant_key);

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.line_id === lineId);

      if (idx >= 0) {
        const next = [...prev];
        const current = next[idx];
        const newQty = Math.max(0, Math.min(999, current.qty + qty));

        if (newQty <= 0) return next.filter((l) => l.line_id !== lineId);

        next[idx] = {
          ...current,
          qty: newQty,

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

          variant: {
            variant_id: v.variant_id ?? current.variant?.variant_id ?? null,
            variant_key: v.variant_key || current.variant?.variant_key || "default",
            label: v.label ?? current.variant?.label ?? null,
            price: unitPrice, // ✅ on stocke le prix réellement utilisé (utile pour checkout)
          },

          product: p,
        };

        return next;
      }

      if (qty <= 0) return prev;

      const line: CartLine = {
        line_id: lineId,
        id: Number(p.id),
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

        variant: {
          variant_id: v.variant_id,
          variant_key: v.variant_key,
          label: v.label,
          price: unitPrice, // ✅ prix réellement utilisé
        },
      };

      return [...prev, line];
    });
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.line_id !== lineId));
  };

  const removeProduct = (productId: number) => {
    const pid = Number(productId);
    setLines((prev) => prev.filter((l) => Number(l.id) !== pid));
  };

  const setQtyLine = (lineId: string, qty: number) => {
    const normalized = Math.max(0, Math.min(999, Math.floor(qty || 0)));
    setLines((prev) => {
      if (normalized === 0) return prev.filter((l) => l.line_id !== lineId);
      return prev.map((l) => (l.line_id === lineId ? { ...l, qty: normalized } : l));
    });
  };

  const clear = () => setLines([]);

  const qtyForProduct = (productId: number) => {
    const pid = Number(productId);
    return lines.reduce((s, l) => (Number(l.id) === pid ? s + Number(l.qty || 0) : s), 0);
  };

  const qtyForProductVariant = (productId: number, variantKey: string) => {
    const pid = Number(productId);
    const key = String(variantKey || "default").trim() || "default";
    return lines.reduce((s, l) => {
      if (Number(l.id) !== pid) return s;
      const k = String(l.variant?.variant_key || "default").trim() || "default";
      return k === key ? s + Number(l.qty || 0) : s;
    }, 0);
  };

  const totalItems = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const totalAmount = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);

  const value: CartState = {
    lines,
    add,
    removeLine,
    removeProduct,
    setQtyLine,
    clear,
    totalItems,
    totalAmount,
    qtyForProduct,
    qtyForProductVariant,
  };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export const mad = moneyMAD;

// src/store/cart.ts
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "../services/products";
import { moneyMAD } from "../utils/money";

export type CartVariant = {
  variant_id: number | null;
  variant_key: string;
  label: string | null;
  price: number | null;
};

export type CartLine = {
  line_id: string;
  id: number;
  name: string;
  price: number;
  base_unit_price?: number;
  has_promo?: boolean;
  promo_amount?: number;
  promo_percent_label?: string | null;

  cover?: string | null;
  product: Product;
  qty: number;

  shop_id?: number | null;

  sub_category_id?: number | null;
  sub_category_slug?: string | null;
  sub_category_name?: string | null;

  category_id?: number | null;
  category_slug?: string | null;
  category_name?: string | null;

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
  totalBaseAmount: number;
  totalPromoAmount: number;

  qtyForProduct: (productId: number) => number;
  qtyForProductVariant: (productId: number, variantKey: string) => number;
};

const CartCtx = createContext<CartState | null>(null);
const LS_KEY = "duumini.cart.v3";

function makeLineId(productId: number, variantKey: string) {
  const key = String(variantKey || "default").trim() || "default";
  return `${Number(productId)}__${key}`;
}

function toFiniteNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeRound(n: number) {
  return +Number(n || 0).toFixed(2);
}

function normalizePromoType(value: any) {
  const t = String(value || "").trim().toUpperCase();
  if (t === "AMOUNT") return "AMOUNT";
  if (t === "PERCENT") return "PERCENT";
  return "PERCENT";
}

function computePromoPrice(basePrice: number, promoEligible: boolean, type: string, value: number) {
  const base = Number(basePrice || 0);
  if (!promoEligible) return null;
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(value) || value <= 0) return null;

  let out = base;
  if (type === "AMOUNT") out = base - value;
  else out = base * (1 - value / 100);

  if (!Number.isFinite(out)) return null;
  if (out < 0) out = 0;

  return safeRound(out);
}

function getBaseClientPrice(p: any) {
  return safeRound(
    toFiniteNumber(
      p?.price_client ??
        p?.client_price ??
        p?.price ??
        0,
      0
    )
  );
}

function getFinalProductPrice(p: any) {
  const base = getBaseClientPrice(p);

  const promoEligible =
    Number(p?.promo_eligible ?? 0) === 1 ||
    Boolean(p?.promo_price) ||
    Boolean(p?.promo_percent) ||
    Boolean(p?.promo_discount_value);

  const promoPriceRaw = toFiniteNumber(p?.promo_price, NaN);
  if (Number.isFinite(promoPriceRaw) && promoPriceRaw > 0 && promoPriceRaw < base) {
    return {
      base_unit_price: base,
      final_unit_price: safeRound(promoPriceRaw),
      has_promo: true,
      promo_amount: safeRound(base - promoPriceRaw),
      promo_percent_label: base > 0 ? `${Math.round(((base - promoPriceRaw) / base) * 100)}%` : null,
    };
  }

  const promoPercentRaw = toFiniteNumber(p?.promo_percent, NaN);
  if (Number.isFinite(promoPercentRaw) && promoPercentRaw > 0) {
    const out = safeRound(base * (1 - promoPercentRaw / 100));
    return {
      base_unit_price: base,
      final_unit_price: out,
      has_promo: out < base,
      promo_amount: safeRound(Math.max(0, base - out)),
      promo_percent_label: `${Math.round(promoPercentRaw)}%`,
    };
  }

  const promoValue = toFiniteNumber(p?.promo_discount_value, NaN);
  const hasPromoValue = Number.isFinite(promoValue) && promoValue > 0;
  const promoType = normalizePromoType(p?.promo_discount_type || "PERCENT");

  if (promoEligible && hasPromoValue) {
    const promoOut = computePromoPrice(base, true, promoType, promoValue);
    if (promoOut != null) {
      const reduction = safeRound(Math.max(0, base - promoOut));
      return {
        base_unit_price: base,
        final_unit_price: promoOut,
        has_promo: promoOut < base,
        promo_amount: reduction,
        promo_percent_label:
          promoType === "PERCENT"
            ? `${Math.round(promoValue)}%`
            : base > 0
            ? `${Math.round((reduction / base) * 100)}%`
            : null,
      };
    }
  }

  return {
    base_unit_price: base,
    final_unit_price: base,
    has_promo: false,
    promo_amount: 0,
    promo_percent_label: null,
  };
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];

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

      const price = toFiniteNumber((l as any).price, 0);
      const base_unit_price = toFiniteNumber((l as any).base_unit_price ?? price, price);
      const promo_amount = safeRound(Math.max(0, base_unit_price - price));
      const has_promo = promo_amount > 0;

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
        price: Number.isFinite(variantPrice as any) ? Number(variantPrice) : null,
      };

      out.push({
        ...(l as any),
        line_id,
        id,
        qty: Math.floor(qty),
        price: safeRound(price),
        base_unit_price: safeRound(base_unit_price),
        has_promo,
        promo_amount,
        promo_percent_label: (l as any)?.promo_percent_label ?? null,
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
    price: Number.isFinite(price as any) ? Number(price) : null,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => load());

  useEffect(() => {
    save(lines);
  }, [lines]);

  const add = (p: Product, qty = 1, meta?: AddMeta) => {
    const anyP = p as any;
    const cover = safeCover(anyP);
    const shopId = anyP.shop_id != null ? Number(anyP.shop_id) : null;
    const sc = pickSubCategoryFlat(anyP);
    const v = normalizeVariant(meta);

    const pricePack = getFinalProductPrice(anyP);

    const unitPrice =
      v.price != null && Number.isFinite(Number(v.price))
        ? safeRound(Number(v.price))
        : safeRound(pricePack.final_unit_price);

    const baseUnitPrice = safeRound(
      v.price != null && Number.isFinite(Number(v.price))
        ? Number(v.price)
        : pricePack.base_unit_price
    );

    const promoAmount = safeRound(Math.max(0, baseUnitPrice - unitPrice));
    const hasPromo = promoAmount > 0;

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
          base_unit_price: baseUnitPrice,
          has_promo: hasPromo,
          promo_amount: promoAmount,
          promo_percent_label: hasPromo ? pricePack.promo_percent_label : null,
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
            price: unitPrice,
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
        base_unit_price: baseUnitPrice,
        has_promo: hasPromo,
        promo_amount: promoAmount,
        promo_percent_label: hasPromo ? pricePack.promo_percent_label : null,
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
          price: unitPrice,
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

  const totalItems = useMemo(() => lines.reduce((s, l) => s + Number(l.qty || 0), 0), [lines]);

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.price || 0), 0),
    [lines]
  );

  const totalBaseAmount = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.base_unit_price ?? l.price ?? 0), 0),
    [lines]
  );

  const totalPromoAmount = useMemo(
    () => safeRound(Math.max(0, totalBaseAmount - totalAmount)),
    [totalBaseAmount, totalAmount]
  );

  const value: CartState = {
    lines,
    add,
    removeLine,
    removeProduct,
    setQtyLine,
    clear,
    totalItems,
    totalAmount,
    totalBaseAmount,
    totalPromoAmount,
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
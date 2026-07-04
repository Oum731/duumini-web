// src/pages/products/productForm/helpers.ts
import type { ProductVariant } from "../../../services/products";
import { toCents, fromCents, moneyMAD } from "../../../utils/money";
import type { PromoDiscountType, ProductStyle, Vertical, VariantDraft } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computePromoPrice(price: number, type: PromoDiscountType, value: number) {
  const priceC = toCents(price);
  const v = Number(value);
  if (priceC <= 0 || !Number.isFinite(v) || v <= 0) return fromCents(priceC);

  if (type === "PERCENT") {
    const pct = clamp(v, 0, 100);
    const discountC = Math.round((priceC * pct) / 100);
    const outC = Math.max(0, priceC - discountC);
    return fromCents(outC);
  }

  const discountC = toCents(v);
  const outC = Math.max(0, priceC - discountC);
  return fromCents(outC);
}

export function isActive(p: any): 0 | 1 {
  const v =
    p?.is_active != null
      ? Number(p.is_active)
      : p?.active != null
      ? Number(p.active)
      : 1;
  return (v === 0 ? 0 : 1) as 0 | 1;
}

export function hasRealPromo(p: any): boolean {
  const eligible = Number(p?.promo_eligible || 0) === 1;
  const val = Number(p?.promo_discount_value || 0);
  return eligible && Number.isFinite(val) && val > 0;
}

export function promoLabel(p: any): string {
  if (!hasRealPromo(p)) return "—";
  const t = String(p?.promo_discount_type || "").toUpperCase();
  const v = Number(p?.promo_discount_value || 0);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return t === "AMOUNT" ? `-${moneyMAD(v)}` : `-${Math.round(v)}%`;
}

export function basePriceForAdmin(p: any): number {
  const n = Number(p?.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function promoPriceForAdmin(p: any): number | null {
  if (!hasRealPromo(p)) return null;
  const price = basePriceForAdmin(p);
  const t: PromoDiscountType =
    String(p?.promo_discount_type || "").toUpperCase() === "AMOUNT"
      ? "AMOUNT"
      : "PERCENT";
  const v = Number(p?.promo_discount_value || 0);
  if (price <= 0 || !Number.isFinite(v) || v <= 0) return null;
  return computePromoPrice(price, t, v);
}

export function splitNames(raw: string) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function normalizeVertical(v: any): Vertical | null {
  const x = String(v ?? "").trim().toUpperCase();
  if (x === "FOOD" || x === "MARKET" || x === "FASHION") return x as Vertical;
  return null;
}

export function inferStyleFromProduct(p: any): ProductStyle | "" {
  const v = normalizeVertical(p?.vertical);
  if (v === "FOOD") return "food";
  if (v === "MARKET") return "market";
  if (v === "FASHION") return "fashion";
  return "";
}

export function styleToVertical(st: any): Vertical | null {
  const s = String(st || "").trim().toLowerCase();
  if (s === "food") return "FOOD";
  if (s === "market") return "MARKET";
  if (s === "fashion") return "FASHION";
  return null;
}

function normStr(x: any, max = 60): string | null {
  const s = String(x ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}
export function normStock(x: any): number {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
export function normPriceOverride(x: any): number | null {
  if (x === "" || x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function cleanVariantsForApi(
  list: VariantDraft[]
): Array<Partial<ProductVariant> & { stock?: number }> {
  const out: Array<Partial<ProductVariant> & { stock?: number }> = [];
  for (const v of list || []) {
    const size = normStr(v.size, 20);
    const color = normStr(v.color, 40);
    const sku = normStr(v.sku, 80);

    if (!size || !color) continue;

    out.push({
      size,
      color,
      sku,
      stock: normStock(v.stock),
      price_override: normPriceOverride(v.price_override),
      is_active: (v.is_active ?? 1) as any,
    });
  }
  return out;
}

export function toUpperSku(s?: string | null) {
  const x = String(s ?? "").trim();
  if (!x) return "";
  return x.toUpperCase().replace(/\s+/g, "-").slice(0, 80);
}

export function buildSkuAuto(name: string, size?: string | null, color?: string | null) {
  const n = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  const s = String(size || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 8);
  const c = String(color || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 10);

  const parts = [n || "DUU", s || "X", c || "X"].filter(Boolean);
  return parts.join("-").slice(0, 80);
}

function normKeyPart(x: any) {
  return String(x ?? "").trim().toLowerCase();
}
export function vKey(size?: string | null, color?: string | null) {
  return `${normKeyPart(size)}|${normKeyPart(color)}`;
}
export function uniq(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const t = String(x ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

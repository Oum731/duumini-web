import { toCents, fromCents, moneyMAD } from "../../utils/money";

export type PromoDiscountType = "PERCENT" | "AMOUNT";
export { toCents, fromCents, moneyMAD };

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function isActive(p: any): 0 | 1 {
  return Number(p?.is_active ?? p?.active ?? 1) ? 1 : 0;
}

export function hasRealPromo(p: any): boolean {
  return (
    isActive(p) === 1 &&
    Number(p?.promo_eligible || 0) === 1 &&
    Number(p?.promo_discount_value ?? 0) > 0
  );
}

export function computePromoPrice(
  price: number,
  type: PromoDiscountType,
  value: number
) {
  const priceC = toCents(price);
  const v = Number(value);

  if (priceC <= 0 || !Number.isFinite(v) || v <= 0)
    return fromCents(priceC);

  if (type === "PERCENT") {
    const pct = clamp(v, 0, 100);
    const discountC = Math.round((priceC * pct) / 100);
    return fromCents(Math.max(0, priceC - discountC));
  }

  const discountC = toCents(v);
  return fromCents(Math.max(0, priceC - discountC));
}

export function basePriceForAdmin(p: any): number {
  const hasVariants =
    !!p?.has_variants || Number(p?.variants_count || 0) > 0;

  const minp =
    p?.min_price == null || p?.min_price === ""
      ? null
      : Number(p.min_price);

  const price =
    p?.price == null || p?.price === ""
      ? 0
      : Number(p.price);

  if (hasVariants && minp != null && Number.isFinite(minp))
    return minp;

  return Number.isFinite(price) ? price : 0;
}
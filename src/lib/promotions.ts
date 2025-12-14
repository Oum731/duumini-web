export type PromoDiscountType = "PERCENT" | "AMOUNT";

export function computePromoPrice(
  price: number,
  type: PromoDiscountType,
  value: number
) {
  const p = Number(price || 0);
  const v = Number(value || 0);
  if (!p || !v) return p;

  if (type === "PERCENT") {
    const pct = Math.max(0, Math.min(100, v));
    return Math.max(0, Number((p - (p * pct) / 100).toFixed(2)));
  }
  return Math.max(0, Number((p - v).toFixed(2)));
}

export function getPromoMeta(p: any) {
  const isEligible = Number(p?.promo_eligible ?? 0) === 1;
  const value = Number(p?.promo_discount_value ?? 0);
  const type: PromoDiscountType =
    p?.promo_discount_type === "AMOUNT" ? "AMOUNT" : "PERCENT";

  if (!isEligible || value <= 0 || Number(p?.price ?? 0) <= 0) return null;

  const oldPrice = Number(p.price || 0);
  const promoPrice = computePromoPrice(oldPrice, type, value);
  if (promoPrice >= oldPrice) return null;

  const saved = oldPrice - promoPrice;
  const label = type === "PERCENT" ? `-${Math.round(value)}%` : `-${Math.round(value)} MAD`;

  return { promoPrice, oldPrice, saved, label, type, value };
}

export function isRealPromo(p: any) {
  const isFood = String(p?.sub_category || "").toLowerCase() === "food";
  return !isFood && !!getPromoMeta(p);
}

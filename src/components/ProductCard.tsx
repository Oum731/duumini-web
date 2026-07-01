// src/components/ProductCard.tsx
import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Eye, ShoppingCart, Star } from "lucide-react";
import type { Product } from "../services/products";
import { useCart } from "../store/cart";
import ProductRating from "./ProductRating";
import { trackAddToCart } from "../lib/analytics";
import { moneyMAD, toNum, toCents, fromCents, roundToMAD } from "../utils/money";
import { imgUrl } from "../utils/media";

function shortText(s?: string | null, max = 140) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function normToken(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function getSubCategoryToken(p: Product) {
  const anyP = p as any;

  const bySlug = normToken(anyP.sub_category_slug);
  if (bySlug) return bySlug;

  const byName = normToken(anyP.sub_category_name);
  if (byName) return byName;

  const id = anyP.sub_category_id;
  if (id != null && String(id).trim() !== "") return normToken(String(id));

  return "";
}

function getDisplayPrice(anyP: any, priceOverride: number | null) {
  if (priceOverride != null) return toNum(priceOverride || 0);

  const p = anyP.price;
  if (p != null && p !== "") return toNum(p || 0);

  const pc = anyP.price_client ?? anyP.client_price ?? null;
  if (pc != null && pc !== "") return toNum(pc || 0);

  return 0;
}

type PromoRule =
  | { kind: "PERCENT"; value: number }
  | { kind: "AMOUNT"; value: number }
  | { kind: "RATIO"; factor: number }
  | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePromoCentsFromRule(baseCents: number, rule: PromoRule) {
  let p = Math.max(0, Math.round(baseCents || 0));
  if (!p || !rule) return roundToMAD(p);

  if (rule.kind === "PERCENT") {
    const pct = clamp(toNum(rule.value), 0, 100);
    const off = Math.round((p * pct) / 100);
    return roundToMAD(Math.max(0, p - off));
  }

  if (rule.kind === "AMOUNT") {
    const amt = Math.max(0, toCents(rule.value));
    return roundToMAD(Math.max(0, p - amt));
  }

  const f = clamp(toNum(rule.factor), 0, 1);
  return roundToMAD(Math.max(0, Math.round(p * f)));
}

function computePromoPriceFromRule(price: number, rule: PromoRule) {
  const promoCents = computePromoCentsFromRule(toCents(price || 0), rule);
  return fromCents(promoCents);
}

function formatPromoBadge(rule: PromoRule, base: number, promo: number) {
  if (!rule) return "PROMO";
  if (rule.kind === "PERCENT") return `-${Math.round(rule.value)}%`;
  if (rule.kind === "AMOUNT") return `-${moneyMAD(rule.value)}`;
  if (base > 0 && promo >= 0 && promo < base) {
    const pct = Math.round(((base - promo) / base) * 100);
    if (pct > 0) return `-${pct}%`;
  }
  return "PROMO";
}

function getPromoMeta(anyP: any, basePrice: number) {
  const base = toNum(basePrice || 0);
  if (!base) {
    return {
      isPromo: false,
      rule: null as PromoRule,
      oldPrice: null as number | null,
      badgeText: null as string | null,
    };
  }

  const flag =
    anyP.is_promo === true ||
    anyP.promo === true ||
    anyP.on_promo === true ||
    Number(anyP.promo_eligible ?? 0) === 1;

  const promoPriceDirect =
    toNum(
      anyP.promo_price_client ??
        anyP.promo_price ??
        anyP.price_promo ??
        anyP.sale_price ??
        0
    ) || 0;

  if (promoPriceDirect > 0 && promoPriceDirect < base) {
    const baseC = toCents(base);
    const promoC = roundToMAD(toCents(promoPriceDirect));
    if (promoC > 0 && promoC < baseC) {
      const factor = clamp(promoC / baseC, 0, 1);
      const rule: PromoRule = { kind: "RATIO", factor };
      return {
        isPromo: true,
        rule,
        oldPrice: fromCents(roundToMAD(baseC)),
        badgeText: formatPromoBadge(
          rule,
          fromCents(roundToMAD(baseC)),
          fromCents(promoC)
        ),
      };
    }
  }

  const typeRaw = String(
    anyP.promo_discount_type ?? anyP.discount_type ?? anyP.promo_type ?? ""
  )
    .trim()
    .toUpperCase();

  const valueRaw =
    toNum(
      anyP.promo_discount_value ??
        anyP.discount_value ??
        anyP.promo_value ??
        0
    ) || 0;

  if (
    valueRaw > 0 &&
    (typeRaw === "PERCENT" || typeRaw === "PCT" || typeRaw === "%")
  ) {
    const rule: PromoRule = { kind: "PERCENT", value: clamp(valueRaw, 0, 100) };
    const promo = computePromoPriceFromRule(base, rule);
    if (promo < base) {
      return {
        isPromo: true,
        rule,
        oldPrice: fromCents(roundToMAD(toCents(base))),
        badgeText: formatPromoBadge(rule, base, promo),
      };
    }
  }

  if (
    valueRaw > 0 &&
    (typeRaw === "AMOUNT" ||
      typeRaw === "MAD" ||
      typeRaw === "PRICE" ||
      typeRaw === "VALUE")
  ) {
    const rule: PromoRule = { kind: "AMOUNT", value: Math.max(0, valueRaw) };
    const promo = computePromoPriceFromRule(base, rule);
    if (promo < base) {
      return {
        isPromo: true,
        rule,
        oldPrice: fromCents(roundToMAD(toCents(base))),
        badgeText: formatPromoBadge(rule, base, promo),
      };
    }
  }

  if (flag) {
    return { isPromo: false, rule: null, oldPrice: null, badgeText: null };
  }

  return { isPromo: false, rule: null, oldPrice: null, badgeText: null };
}

type UiVariant = {
  id: number;
  key: string;
  label: string;
  price: number | null;
  stock: number | null;
};

function buildVariantLabel(v: any) {
  const name = String(v?.name || v?.title || "").trim();
  if (name) return name;

  const attrs = v?.attrs && typeof v.attrs === "object" ? v.attrs : null;
  const size = String(v?.size ?? attrs?.size ?? "").trim();
  const color = String(v?.color ?? attrs?.color ?? "").trim();

  const parts = [size || null, color || null].filter(Boolean);
  if (parts.length) return parts.join(" · ");

  const sku = String(v?.sku || "").trim();
  if (sku) return sku;

  return `Variante #${Number(v?.id || 0) || "?"}`;
}

function parseVariants(product: Product): UiVariant[] {
  const anyP = product as any;
  const raw = Array.isArray(anyP.variants) ? anyP.variants : [];

  const out: UiVariant[] = [];
  for (const v of raw) {
    const id = Number(v?.id || 0);
    if (!id) continue;

    const label = buildVariantLabel(v);
    const po = v?.price_override;
    const price = po == null || po === "" ? null : toNum(po);
    const stockRaw = v?.stock ?? v?.qty ?? null;
    const stock = stockRaw == null || stockRaw === "" ? null : Number(stockRaw);

    out.push({
      id,
      key: `id:${id}`,
      label,
      price: Number.isFinite(price as any) ? price : null,
      stock: Number.isFinite(stock as any) ? stock : null,
    });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.key)) return false;
    seen.add(x.key);
    return true;
  });
}

function isVariantOutOfStock(v: UiVariant) {
  return v.stock === 0;
}

function isClosedProduct(anyP: any) {
  const stockStatus = String(anyP?.stock_status || "").trim().toUpperCase();
  return Boolean(
    anyP?.is_out_of_stock === true ||
      Number(anyP?.is_out_of_stock || 0) === 1 ||
      stockStatus === "OUT_OF_STOCK"
  );
}

function closedProductMessage(anyP: any) {
  const msg = String(anyP?.availability_message || "").trim();
  return msg || "Ce produit est actuellement en rupture de stock.";
}

type Props = {
  product: Product;
  onAdd?: (p: Product) => void;
  priceOverride?: number | null;
  oldPrice?: number | null;
  badgeText?: string | null;
  hideSubCategories?: string[];
  layout?: "default" | "fashion";
  miniDescMax?: number;
};

function ProductCardInner({
  product,
  onAdd,
  priceOverride = null,
  oldPrice = null,
  badgeText = null,
  hideSubCategories = [],
  layout = "default",
  miniDescMax = 70,
}: Props) {
  const { add } = useCart();
  const anyP = product as any;

  const subCatToken = useMemo(() => getSubCategoryToken(product), [product]);
  const hideList = useMemo(
    () => hideSubCategories.map((x) => normToken(x)).filter(Boolean),
    [hideSubCategories]
  );

  if (subCatToken && hideList.includes(subCatToken)) return null;

  const isActive = Number(anyP.is_active ?? anyP.active ?? 1) === 1;
  if (!isActive) return null;

  const productClosed = useMemo(() => isClosedProduct(anyP), [anyP]);
  const productClosedText = useMemo(() => closedProductMessage(anyP), [anyP]);

  const baseStockRaw = anyP.stock;
  const baseStock =
    baseStockRaw == null || baseStockRaw === "" ? null : Number(baseStockRaw);

  const imagesRaw: string[] = useMemo(() => {
    const arr: string[] = [];
    const cover = anyP.cover || anyP.image || null;
    if (cover) arr.push(String(cover));

    const list = Array.isArray(anyP.images) ? anyP.images : [];
    for (const it of list) {
      const u = typeof it === "string" ? it : it?.url;
      if (u) arr.push(String(u));
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of arr) {
      const key = String(u).trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }, [anyP.cover, anyP.image, anyP.images]);

  const images = useMemo(() => imagesRaw.map((u) => imgUrl(u)), [imagesRaw]);
  const coverUrl = images[0] || "";

  const baseDisplayPrice = useMemo(
    () => getDisplayPrice(anyP, priceOverride),
    [anyP, priceOverride]
  );

  const treatOverrideAsFinal = useMemo(() => {
    return priceOverride != null && (oldPrice != null || !!badgeText);
  }, [badgeText, oldPrice, priceOverride]);

  const promoMeta = useMemo(() => {
    if (treatOverrideAsFinal) {
      return {
        isPromo: false,
        rule: null as PromoRule,
        oldPrice: null,
        badgeText: null,
      };
    }
    return getPromoMeta(anyP, baseDisplayPrice);
  }, [anyP, baseDisplayPrice, treatOverrideAsFinal]);

  const effectiveRule = useMemo(() => {
    if (treatOverrideAsFinal) return null;
    return promoMeta.isPromo ? promoMeta.rule : null;
  }, [promoMeta.isPromo, promoMeta.rule, treatOverrideAsFinal]);

  const variants = useMemo(() => parseVariants(product), [product]);
  const hasVariants = variants.length > 0;

  const [selectedKey, setSelectedKey] = useState<string>(() => {
    if (!variants.length) return "";
    const firstOk = variants.find((v) => !isVariantOutOfStock(v)) || variants[0];
    return firstOk?.key || "";
  });

  const selectedVariant = useMemo(
    () => variants.find((v) => v.key === selectedKey) || null,
    [variants, selectedKey]
  );

  const rawPrice = useMemo(() => {
    if (selectedVariant?.price != null) return toNum(selectedVariant.price);
    return baseDisplayPrice;
  }, [baseDisplayPrice, selectedVariant]);

  const displayPrice = useMemo(() => {
    if (treatOverrideAsFinal) return toNum(rawPrice);
    const rawCents = toCents(rawPrice);
    const promoCents = computePromoCentsFromRule(rawCents, effectiveRule);
    return fromCents(promoCents);
  }, [rawPrice, effectiveRule, treatOverrideAsFinal]);

  const effectiveOldPrice = useMemo(() => {
    const dispCents = toCents(displayPrice);

    if (oldPrice != null) {
      const oldC = roundToMAD(toCents(oldPrice));
      if (oldC > dispCents) return fromCents(oldC);
    }

    if (!treatOverrideAsFinal && promoMeta.isPromo) {
      const rawC = roundToMAD(toCents(rawPrice));
      if (rawC > dispCents) return fromCents(rawC);
    }

    return null;
  }, [displayPrice, oldPrice, promoMeta.isPromo, rawPrice, treatOverrideAsFinal]);

  const effectiveBadgeText = useMemo(() => {
    if (badgeText) return badgeText;
    if (!treatOverrideAsFinal && promoMeta.isPromo) {
      return promoMeta.badgeText || "PROMO";
    }
    return null;
  }, [badgeText, promoMeta.badgeText, promoMeta.isPromo, treatOverrideAsFinal]);

  const effectiveStock = useMemo(() => {
    if (hasVariants && selectedVariant?.stock != null) return selectedVariant.stock;
    return baseStock;
  }, [baseStock, hasVariants, selectedVariant]);

  const canAddNow = useMemo(() => {
    if (productClosed) return false;
    if (!hasVariants) return !(baseStock === 0);
    if (!selectedVariant) return false;
    if (selectedVariant.stock === 0) return false;
    if (effectiveStock === 0) return false;
    return true;
  }, [productClosed, baseStock, effectiveStock, hasVariants, selectedVariant]);

  const handleAdd = useCallback(() => {
    if (productClosed) return;

    const raw =
      hasVariants && selectedVariant?.price != null
        ? toNum(selectedVariant.price)
        : baseDisplayPrice;

    const finalPrice = treatOverrideAsFinal
      ? fromCents(roundToMAD(toCents(raw)))
      : fromCents(computePromoCentsFromRule(toCents(raw), effectiveRule));

    const rawRounded = fromCents(roundToMAD(toCents(raw)));

    const productForCart: any = {
      ...anyP,
      price: finalPrice,
      _pricing: {
        rawPrice: rawRounded,
        finalPrice,
        isPromo: finalPrice < rawRounded,
        badge: effectiveBadgeText ?? null,
        oldPrice: finalPrice < rawRounded ? rawRounded : null,
      },
    };

    add(productForCart, 1, {
      variant:
        hasVariants && selectedVariant
          ? {
              variant_id: selectedVariant.id,
              variant_key: selectedVariant.key,
              label: selectedVariant.label,
              price: selectedVariant.price ?? raw,
            }
          : {
              variant_id: null,
              variant_key: "default",
              label: null,
              price: finalPrice,
            },
    });

    onAdd?.(productForCart);

    trackAddToCart({
      productId: anyP.id,
      name: anyP.name,
      price: finalPrice,
      quantity: 1,
      currency: "MAD",
      category: subCatToken || "",
    });
  }, [
    add,
    anyP,
    baseDisplayPrice,
    effectiveBadgeText,
    effectiveRule,
    hasVariants,
    onAdd,
    selectedVariant,
    subCatToken,
    treatOverrideAsFinal,
    productClosed,
  ]);

  const productPath = useMemo(() => {
    const id = Number(anyP.id || 0);
    return id > 0 ? `/products/${id}` : "#";
  }, [anyP.id]);

  const sellerName = String(
    anyP.shop_name ||
      anyP.vendor_name ||
      anyP.seller_name ||
      anyP.brand ||
      "Duumini"
  );

  return (
    <div
      className={`card border-0 shadow-sm duu-card ${
        layout === "fashion" ? "duu-card--fashion" : "duu-card--default"
      }`}
    >
      <style>{`
        .duu-card{
          border-radius: 22px;
          overflow: hidden;
          background: #fff;
          border: 1px solid rgba(17,17,17,.06);
          box-shadow: 0 10px 24px rgba(0,0,0,.06) !important;
          transition: transform .18s ease, box-shadow .18s ease;
          height: 100%;
        }
        .duu-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(0,0,0,.08) !important;
        }

        .duu-card--default .card-body,
        .duu-card--fashion .card-body{
          padding: 13px;
        }

        .duu-media{
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(0,0,0,.03), rgba(0,0,0,.06));
        }
        .duu-media--default{ aspect-ratio: 1 / 1; }
        .duu-media--fashion{ aspect-ratio: 4 / 5; }

        .duu-media-link{
          display: block;
          width: 100%;
          height: 100%;
        }

        .duu-media-img{
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform .35s ease;
        }
        .duu-card:hover .duu-media-img{
          transform: scale(1.03);
        }

        .duu-badge{
          position: absolute;
          z-index: 2;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: .76rem;
          font-weight: 950;
          line-height: 1;
          box-shadow: 0 8px 18px rgba(0,0,0,.12);
        }
        .duu-badge--promo{
          background: var(--duu-yellow);
          color: var(--duu-black);
        }
        .duu-badge--danger{
          background: rgba(17,17,17,.86);
          color: #fff;
        }

        .duu-seller{
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: .75rem;
          font-weight: 800;
          color: rgba(0,0,0,.55);
          margin-bottom: 8px;
        }

        .duu-title-link{
          color: var(--duu-black);
          text-decoration: none;
        }
        .duu-title{
          font-weight: 900;
          line-height: 1.18;
          margin: 0;
          color: var(--duu-black);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 2.45em;
          font-size: .96rem;
        }

        .duu-desc{
          color: rgba(0,0,0,.55);
          font-size: .82rem;
          line-height: 1.28;
          margin: 6px 0 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 2.35em;
        }

        .duu-rating-row{
          margin-top: 8px;
        }

        .duu-price-row{
          margin-top: 10px;
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }
        .duu-price-main{
          font-size: 1.08rem;
          font-weight: 950;
          color: var(--duu-black);
          line-height: 1;
        }
        .duu-price-old{
          color: rgba(0,0,0,.42);
          text-decoration: line-through;
          font-weight: 800;
          font-size: .85rem;
        }

        .duu-status{
          margin-top: 10px;
          padding: 8px 10px;
          border-radius: 12px;
          background: rgba(217,45,32,.08);
          border: 1px solid rgba(217,45,32,.14);
          color: #a61b12;
          font-size: .78rem;
          font-weight: 800;
          line-height: 1.3;
        }

        .duu-section-label{
          font-size: .76rem;
          font-weight: 900;
          color: rgba(0,0,0,.62);
          margin-bottom: 6px;
        }

        .duu-variant-wrap{ margin-top: 10px; }
        .duu-select{
          border-radius: 12px;
          min-height: 38px;
          font-size: .86rem;
        }
        .duu-select:focus{
          outline: none !important;
          box-shadow: 0 0 0 .22rem rgba(255,208,0,.28) !important;
          border-color: rgba(255,208,0,.52) !important;
        }

        .duu-bottom{
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 48px;
          gap: 10px;
          align-items: stretch;
        }

        .duu-action-main{
          min-height: 42px;
          border-radius: 14px;
          border: none;
          background: var(--duu-yellow);
          color: var(--duu-black);
          font-weight: 950;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .duu-action-main:disabled{
          opacity: .6;
        }

        .duu-icon-main{
          min-height: 42px;
          min-width: 48px;
          border-radius: 14px;
          border: 1px solid rgba(17,17,17,.08);
          background: #fff;
          color: var(--duu-black);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 480px){
          .duu-card--default .card-body,
          .duu-card--fashion .card-body{
            padding: 11px;
          }
          .duu-title{ font-size: .9rem; }
          .duu-price-main{ font-size: 1rem; }
          .duu-bottom{ grid-template-columns: 1fr 44px; }
        }
      `}</style>

      <div
        className={
          layout === "fashion"
            ? "duu-media duu-media--fashion"
            : "duu-media duu-media--default"
        }
      >
        <Link to={productPath} className="duu-media-link" title={String(anyP.name || "")}>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={String(anyP.name || "")}
              className="duu-media-img"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-100 h-100" />
          )}
        </Link>

        {effectiveBadgeText && !productClosed && !(effectiveStock != null && effectiveStock <= 0) ? (
          <span className="duu-badge duu-badge--promo">{effectiveBadgeText}</span>
        ) : null}

        {(productClosed || (effectiveStock != null && effectiveStock <= 0)) ? (
          <span className="duu-badge duu-badge--danger">En rupture</span>
        ) : null}
      </div>

      <div className="card-body d-flex flex-column">
        <div className="duu-seller">
          <Star size={12} />
          <span>{sellerName}</span>
        </div>

        <Link to={productPath} className="duu-title-link">
          <h3 className="duu-title" title={String(anyP.name || "")}>{String(anyP.name || "")}</h3>
        </Link>

        {!!anyP.description && (
          <p className="duu-desc">{shortText(String(anyP.description), miniDescMax)}</p>
        )}

        <div className="duu-rating-row">
          <ProductRating productId={Number(anyP.id)} />
        </div>

        <div className="duu-price-row">
          <span className="duu-price-main">{moneyMAD(displayPrice)}</span>
          {effectiveOldPrice != null &&
            toNum(effectiveOldPrice) > toNum(displayPrice) && (
              <span className="duu-price-old">{moneyMAD(effectiveOldPrice)}</span>
            )}
        </div>

        {productClosed ? (
          <div className="duu-status">{productClosedText}</div>
        ) : null}

        {hasVariants ? (
          <div className="duu-variant-wrap">
            <div className="duu-section-label">Variante</div>
            <select
              className="form-select form-select-sm duu-select"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              aria-label="Sélection de variante"
              disabled={productClosed}
            >
              {variants.map((v) => (
                <option key={v.key} value={v.key} disabled={isVariantOutOfStock(v)}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="duu-bottom">
          <button
            className="duu-action-main"
            onClick={handleAdd}
            disabled={!canAddNow}
            type="button"
          >
            <ShoppingCart size={16} />
            {productClosed ? "Produit indisponible" : "Ajouter au panier"}
          </button>

          <Link to={productPath} className="duu-icon-main" title="Voir">
            <Eye size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function areEqual(prev: Props, next: Props) {
  const prevId = Number((prev.product as any)?.id || 0);
  const nextId = Number((next.product as any)?.id || 0);
  if (prevId !== nextId) return false;

  if (Number(prev.priceOverride ?? 0) !== Number(next.priceOverride ?? 0)) return false;
  if (Number(prev.oldPrice ?? 0) !== Number(next.oldPrice ?? 0)) return false;
  if (String(prev.badgeText ?? "") !== String(next.badgeText ?? "")) return false;
  if (prev.layout !== next.layout) return false;
  if (prev.miniDescMax !== next.miniDescMax) return false;

  if ((prev.hideSubCategories?.join("|") || "") !== (next.hideSubCategories?.join("|") || ""))
    return false;

  return true;
}

export default React.memo(ProductCardInner, areEqual);
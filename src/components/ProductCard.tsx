// src/components/ProductCard.tsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../services/products";
import { API_BASE } from "../services/http";
import { useCart } from "../store/cart";
import ProductRating from "./ProductRating";
import { trackAddToCart } from "../lib/analytics";

/* =========================
 * Helpers
 * =======================*/
function imgUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return s;
}

function toNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function toCents(x: any): number {
  return Math.round(toNum(x) * 100);
}
function fromCents(c: any): number {
  const n = Number(c);
  return Number.isFinite(n) ? Math.round(n) / 100 : 0;
}
function roundToMAD(cents: number) {
  return Math.round((cents || 0) / 100) * 100;
}
function moneyMAD(n?: number | null) {
  const cents = roundToMAD(toCents(n ?? 0));
  const v = fromCents(cents);
  const s = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
  return `${s} MAD`;
}

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

function cleanBase(x: string) {
  return String(x || "").trim().replace(/\/+$/, "");
}

function getWebOrigin() {
  const fromEnv =
    (typeof import.meta !== "undefined" &&
      ((import.meta as any).env?.VITE_WEB_ORIGIN ||
        (import.meta as any).env?.VITE_SITE_ORIGIN)) ||
    "";

  const v = cleanBase(fromEnv);
  if (v) return v;

  return "https://www.duumini.com";
}

function getProductId(p: Product) {
  const id = Number((p as any).id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function buildPublicProductUrl(p: Product) {
  const web = getWebOrigin();
  const id = getProductId(p);
  if (!web || !id) return "";
  return `${web}/products/${id}`;
}

function buildShareOgUrl(p: Product) {
  const web = getWebOrigin();
  const id = getProductId(p);
  if (!web || !id) return "";
  return `${web}/share/product/${id}`;
}

function buildShareLinks(shareUrl: string, text: string) {
  const u = encodeURIComponent(shareUrl);
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    email: `mailto:?subject=${encodeURIComponent("Duumini")}&body=${t}%0A${u}`,
  };
}

async function fetchAsFile(url: string, filename: string): Promise<File | null> {
  try {
    if (!url) return null;

    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || !blob.size) return null;

    const MAX = 10 * 1024 * 1024;
    if (blob.size > MAX) return null;

    const type = blob.type || "image/jpeg";
    const safeName =
      filename.endsWith(".jpg") || filename.endsWith(".png")
        ? filename
        : `${filename}.jpg`;

    return new File([blob], safeName, { type });
  } catch {
    return null;
  }
}

function canShareFiles(file: File) {
  const navAny: any = navigator as any;
  if (!navAny?.canShare) return false;
  try {
    return navAny.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function getDisplayPrice(anyP: any, priceOverride: number | null) {
  if (priceOverride != null) return toNum(priceOverride || 0);

  const p = anyP.price;
  if (p != null && p !== "") return toNum(p || 0);

  const pc = anyP.price_client ?? anyP.client_price ?? null;
  if (pc != null && pc !== "") return toNum(pc || 0);

  return 0;
}

/* =========================
 * PROMO
 * =======================*/
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

/* =========================
 * Variantes
 * =======================*/
type UiVariant = {
  id: number;
  key: string;
  label: string;
  price: number | null;
  stock: number | null;
  size: string;
  color: string;
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

function extractSizeColor(v: any) {
  const attrs = v?.attrs && typeof v.attrs === "object" ? v.attrs : null;
  const size = String(v?.size ?? attrs?.size ?? "").trim();
  const color = String(v?.color ?? attrs?.color ?? "").trim();
  return { size, color };
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
    const stock =
      stockRaw == null || stockRaw === "" ? null : Number(stockRaw);

    const { size, color } = extractSizeColor(v);
    const key = `id:${id}`;

    out.push({
      id,
      key,
      label,
      price: Number.isFinite(price as any) ? price : null,
      stock: Number.isFinite(stock as any) ? stock : null,
      size,
      color,
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

/* =========================
 * Component
 * =======================*/
type Props = {
  product: Product;
  onAdd?: (p: Product) => void;
  priceOverride?: number | null;
  oldPrice?: number | null;
  badgeText?: string | null;
  hideSubCategories?: string[];
  layout?: "default" | "fashion";
  miniDescMax?: number;
  stockLabel?: "Disponible" | "Reste";
};

function ProductCardInner({
  product,
  onAdd,
  priceOverride = null,
  oldPrice = null,
  badgeText = null,
  hideSubCategories = [],
  layout = "default",
  miniDescMax = 88,
  stockLabel = "Disponible",
}: Props) {
  const { add, qtyForProduct, qtyForProductVariant } = useCart();
  const anyP = product as any;

  const subCatToken = useMemo(() => getSubCategoryToken(product), [product]);
  const hideList = useMemo(
    () => hideSubCategories.map((x) => normToken(x)).filter(Boolean),
    [hideSubCategories]
  );

  if (subCatToken && hideList.includes(subCatToken)) return null;

  const isActive = Number(anyP.is_active ?? anyP.active ?? 1) === 1;
  if (!isActive) return null;

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

  const [open, setOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareMenuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareMenuOpen(false);
    };

    const onClick = () => setShareMenuOpen(false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick, { capture: true } as any);
    };
  }, [shareMenuOpen]);

  useEffect(() => {
    if (!hasVariants) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => {
      if (prev && variants.some((v) => v.key === prev)) return prev;
      const firstOk =
        variants.find((v) => !isVariantOutOfStock(v)) || variants[0];
      return firstOk?.key || "";
    });
  }, [hasVariants, variants]);

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
    if (!treatOverrideAsFinal && promoMeta.isPromo)
      return promoMeta.badgeText || "PROMO";
    return null;
  }, [badgeText, promoMeta.badgeText, promoMeta.isPromo, treatOverrideAsFinal]);

  const effectiveStock = useMemo(() => {
    if (hasVariants && selectedVariant?.stock != null) return selectedVariant.stock;
    return baseStock;
  }, [baseStock, hasVariants, selectedVariant]);

  const stockTone = useMemo(() => {
    if (effectiveStock == null) return "neutral";
    if (effectiveStock <= 0) return "danger";
    if (effectiveStock <= 5) return "warning";
    return "success";
  }, [effectiveStock]);

  const stockText = useMemo(() => {
    if (effectiveStock == null) return "";
    if (effectiveStock <= 0) return "En rupture";
    return `${stockLabel}: ${effectiveStock}`;
  }, [effectiveStock, stockLabel]);

  const qtyTotal = useMemo(
    () => qtyForProduct(Number(anyP.id)),
    [anyP.id, qtyForProduct]
  );

  const qtySelected = useMemo(() => {
    if (!hasVariants) return qtyTotal;
    const key = selectedVariant?.key || "default";
    return qtyForProductVariant(Number(anyP.id), key);
  }, [anyP.id, hasVariants, qtyForProductVariant, qtyTotal, selectedVariant]);

  const openModal = useCallback(
    (startIdx = 0) => {
      const safe = Math.max(0, Math.min(startIdx, Math.max(0, images.length - 1)));
      setImgIdx(safe);
      setOpen(true);
    },
    [images.length]
  );

  const closeModal = useCallback(() => setOpen(false), []);
  const prevImg = useCallback(() => {
    if (!images.length) return;
    setImgIdx((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);
  const nextImg = useCallback(() => {
    if (!images.length) return;
    setImgIdx((i) => (i + 1) % images.length);
  }, [images.length]);

  const currentImg = images[imgIdx] || coverUrl;

  const canAddNow = useMemo(() => {
    if (!hasVariants) return !(baseStock === 0);
    if (!selectedVariant) return false;
    if (selectedVariant.stock === 0) return false;
    if (effectiveStock === 0) return false;
    return true;
  }, [baseStock, effectiveStock, hasVariants, selectedVariant]);

  const addWithVariant = useCallback(
    (variant: UiVariant | null, delta: number) => {
      if (delta === 0) return;

      const isDefault = !hasVariants || !variant;

      if (!hasVariants && baseStock === 0 && delta > 0) return;
      if (!isDefault && variant && isVariantOutOfStock(variant) && delta > 0) return;

      const raw =
        !isDefault && variant?.price != null
          ? toNum(variant.price)
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

      add(productForCart, delta, {
        variant: isDefault
          ? {
              variant_id: null,
              variant_key: "default",
              label: null,
              price: finalPrice,
            }
          : {
              variant_id: variant!.id,
              variant_key: variant!.key,
              label: variant!.label,
              price: variant!.price ?? raw,
            },
      });

      if (delta > 0) {
        onAdd?.(productForCart);
        trackAddToCart({
          productId: anyP.id,
          name: anyP.name,
          price: finalPrice,
          quantity: 1,
          currency: "MAD",
          category: subCatToken || "",
        });
      }
    },
    [
      add,
      anyP,
      baseDisplayPrice,
      baseStock,
      effectiveBadgeText,
      effectiveRule,
      hasVariants,
      onAdd,
      subCatToken,
      treatOverrideAsFinal,
    ]
  );

  const handleAdd = useCallback(() => {
    addWithVariant(hasVariants ? selectedVariant : null, 1);
  }, [addWithVariant, hasVariants, selectedVariant]);

  const handleDecrease = useCallback(() => {
    if (!qtySelected) return;
    addWithVariant(hasVariants ? selectedVariant : null, -1);
  }, [addWithVariant, hasVariants, qtySelected, selectedVariant]);

  const humanUrl = useMemo(() => buildPublicProductUrl(product), [product]);
  const shareUrl = useMemo(
    () => buildShareOgUrl(product) || humanUrl,
    [product, humanUrl]
  );

  const shareTitle = useMemo(() => {
    const name = String(anyP.name || "Produit");
    if (
      effectiveOldPrice != null &&
      toNum(effectiveOldPrice) > toNum(displayPrice)
    ) {
      return `${name} — Promo ${moneyMAD(displayPrice)} (au lieu de ${moneyMAD(
        effectiveOldPrice
      )})`;
    }
    return `${name} — ${moneyMAD(displayPrice)}`;
  }, [anyP.name, displayPrice, effectiveOldPrice]);

  const shareText = useMemo(() => {
    const desc = String(anyP.description || "").trim();
    const short = desc ? shortText(desc, 90) : "Disponible sur Duumini.";
    return `${shareTitle}\n${short}`;
  }, [anyP.description, shareTitle]);

  const shareLinks = useMemo(
    () => buildShareLinks(shareUrl, shareText),
    [shareUrl, shareText]
  );

  const copyShareUrl = useCallback(async () => {
    try {
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [shareUrl]);

  const openShareLink = useCallback((u: string) => {
    window.open(u, "_blank", "noopener,noreferrer");
  }, []);

  const shareProduct = useCallback(async () => {
    const navAny: any = navigator as any;

    if (!shareUrl) {
      setShareMenuOpen(true);
      return;
    }

    const img = coverUrl || currentImg || "";

    if (navAny?.share && img) {
      const file = await fetchAsFile(
        img,
        `duumini-${getProductId(product) || "product"}.jpg`
      );
      if (file && canShareFiles(file)) {
        try {
          await navAny.share({
            title: String(anyP.name || "Duumini"),
            text: shareText,
            url: shareUrl,
            files: [file],
          });
          return;
        } catch {}
      }
    }

    if (navAny?.share) {
      try {
        await navAny.share({
          title: String(anyP.name || "Duumini"),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {}
    }

    setShareMenuOpen(true);
  }, [anyP.name, coverUrl, currentImg, product, shareText, shareUrl]);

  const productPath = useMemo(() => {
    const id = Number(anyP.id || 0);
    return id > 0 ? `/products/${id}` : "#";
  }, [anyP.id]);

  const PriceBlock = () => (
    <div className="duu-price-wrap">
      <div className="duu-price-row">
        <span className="duu-price-main">{moneyMAD(displayPrice)}</span>

        {effectiveOldPrice != null &&
          toNum(effectiveOldPrice) > toNum(displayPrice) && (
            <span className="duu-price-old">{moneyMAD(effectiveOldPrice)}</span>
          )}
      </div>

      <div className="duu-meta-row">
        {stockText ? (
          <span className={`duu-stock-pill duu-stock-pill--${stockTone}`}>
            {stockText}
          </span>
        ) : null}

        {hasVariants ? <span className="duu-soft-pill">Variantes</span> : null}
      </div>
    </div>
  );

  const VariantSelector = () => {
    if (!hasVariants) return null;

    const selected = selectedVariant;

    const optionLabel = (v: UiVariant) => {
      const sc = [v.size || null, v.color || null].filter(Boolean).join(" · ");
      return sc || v.label;
    };

    return (
      <div className="duu-variant-wrap">
        <div className="duu-section-label">Variante</div>

        <select
          className="form-select form-select-sm duu-select"
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          aria-label="Sélection de variante"
        >
          {variants.map((v) => (
            <option key={v.key} value={v.key} disabled={isVariantOutOfStock(v)}>
              {optionLabel(v)}
            </option>
          ))}
        </select>

        {selected && isVariantOutOfStock(selected) ? (
          <div className="alert alert-warning mt-2 py-2 small mb-0">
            Cette variante est en rupture.
          </div>
        ) : null}
      </div>
    );
  };

  const CardImage = () => {
    const hasMany = images.length > 1;

    if (!coverUrl) {
      return (
        <div
          className={
            layout === "fashion"
              ? "duu-media duu-media--fashion ph"
              : "duu-media duu-media--default ph"
          }
        />
      );
    }

    return (
      <div
        className={
          layout === "fashion"
            ? "duu-media duu-media--fashion"
            : "duu-media duu-media--default"
        }
      >
        <button
          type="button"
          className="duu-media-btn"
          onClick={() => openModal(0)}
          title={String(anyP.name || "")}
        >
          <img
            src={coverUrl}
            alt={String(anyP.name || "")}
            className="duu-media-img"
            loading="lazy"
            decoding="async"
          />
        </button>

        {effectiveBadgeText && !(effectiveStock != null && effectiveStock <= 0) ? (
          <span className="duu-badge duu-badge--promo">{effectiveBadgeText}</span>
        ) : null}

        {effectiveStock != null && effectiveStock <= 0 ? (
          <span className="duu-badge duu-badge--danger">En rupture</span>
        ) : null}

        {hasMany ? (
          <span className="duu-count-badge">{images.length} photos</span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className={`card border-0 shadow-sm duu-card ${layout === "fashion" ? "duu-card--fashion" : "duu-card--default"}`}>
        <style>{`
          .duu-card{
            border-radius: 18px;
            overflow: hidden;
            background: #fff;
            border: 1px solid rgba(0,0,0,.06);
            box-shadow: 0 10px 26px rgba(0,0,0,.06) !important;
            transition: transform .18s ease, box-shadow .18s ease;
          }
          .duu-card:hover{
            transform: translateY(-2px);
            box-shadow: 0 14px 30px rgba(0,0,0,.08) !important;
          }

          .duu-card--default .card-body{
            padding: 14px;
          }
          .duu-card--fashion .card-body{
            padding: 14px;
          }

          .duu-media{
            position: relative;
            overflow: hidden;
            background: #f5f5f5;
          }
          .duu-media--default{
            aspect-ratio: 1 / 1;
          }
          .duu-media--fashion{
            aspect-ratio: 4 / 5;
          }
          .duu-media.ph{
            background: linear-gradient(135deg, rgba(0,0,0,.06), rgba(0,0,0,.02));
          }
          .duu-media-btn{
            all: unset;
            display: block;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .duu-media-img{
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
            transition: transform .35s ease;
          }
          .duu-card:hover .duu-media-img{
            transform: scale(1.025);
          }

          .duu-badge{
            position: absolute;
            z-index: 2;
            top: 12px;
            left: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: .78rem;
            font-weight: 900;
            line-height: 1;
            box-shadow: 0 6px 16px rgba(0,0,0,.12);
          }
          .duu-badge--promo{
            background: rgba(229,57,53,.95);
            color: #fff;
          }
          .duu-badge--danger{
            background: rgba(17,17,17,.86);
            color: #fff;
          }
          .duu-count-badge{
            position: absolute;
            right: 12px;
            bottom: 12px;
            z-index: 2;
            background: rgba(17,17,17,.72);
            color: #fff;
            font-size: .76rem;
            font-weight: 800;
            padding: 6px 9px;
            border-radius: 999px;
            backdrop-filter: blur(4px);
          }

          .duu-card-head{
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .duu-title-link{
            color: var(--duu-black);
            text-decoration: none;
          }
          .duu-title-link:hover{
            color: var(--duu-red);
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
          }
          .duu-desc{
            color: rgba(0,0,0,.58);
            font-size: .88rem;
            line-height: 1.3;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            min-height: 2.5em;
          }

          .duu-rating-row{
            margin-top: 8px;
          }

          .duu-price-wrap{
            margin-top: 10px;
          }
          .duu-price-row{
            display: flex;
            align-items: baseline;
            gap: 8px;
            flex-wrap: wrap;
          }
          .duu-price-main{
            font-size: 1.05rem;
            font-weight: 950;
            color: var(--duu-black);
            line-height: 1;
          }
          .duu-price-old{
            color: rgba(0,0,0,.42);
            text-decoration: line-through;
            font-weight: 800;
            font-size: .92rem;
          }
          .duu-meta-row{
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .duu-stock-pill,
          .duu-soft-pill{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: .78rem;
            font-weight: 800;
            border: 1px solid rgba(0,0,0,.08);
          }
          .duu-soft-pill{
            background: rgba(0,0,0,.04);
            color: rgba(0,0,0,.72);
          }
          .duu-stock-pill--success{
            background: rgba(25,135,84,.08);
            color: #157347;
            border-color: rgba(25,135,84,.18);
          }
          .duu-stock-pill--warning{
            background: rgba(255,193,7,.10);
            color: #7a5a00;
            border-color: rgba(255,193,7,.26);
          }
          .duu-stock-pill--danger{
            background: rgba(220,53,69,.08);
            color: #b02a37;
            border-color: rgba(220,53,69,.18);
          }
          .duu-stock-pill--neutral{
            background: rgba(0,0,0,.04);
            color: rgba(0,0,0,.72);
            border-color: rgba(0,0,0,.08);
          }

          .duu-section-label{
            font-size: .78rem;
            font-weight: 900;
            color: rgba(0,0,0,.64);
            margin-bottom: 6px;
          }
          .duu-variant-wrap{
            margin-top: 10px;
          }
          .duu-select{
            border-radius: 12px;
            min-height: 38px;
          }
          .duu-select:focus{
            outline: none !important;
            box-shadow: 0 0 0 .22rem rgba(255,213,79,.40) !important;
            border-color: rgba(229,57,53,.28) !important;
          }

          .duu-actions{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 14px;
          }

          .btn-duu{
            background: var(--duu-yellow);
            color: #1f1f1f;
            border: none;
            font-weight: 900;
            border-radius: 12px;
          }
          .btn-duu:hover{ filter: brightness(0.96); }

          .duu-qty{
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          .duu-qty-label{
            color: rgba(0,0,0,.58);
            font-size: .82rem;
            font-weight: 700;
          }

          .duu-qty-group .btn,
          .duu-qty-group .btn-light{
            border-radius: 12px !important;
            min-width: 40px;
            font-weight: 900;
          }

          .duu-footer-note{
            margin-top: 10px;
            color: rgba(0,0,0,.54);
            font-size: .78rem;
            line-height: 1.2;
          }

          .duu-share-pop{
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 8px);
            z-index: 60;
            background: #fff;
            border: 1px solid rgba(0,0,0,.08);
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,.12);
            overflow: hidden;
          }
          .duu-share-item{
            all: unset;
            display: block;
            width: 100%;
            padding: 10px 12px;
            cursor: pointer;
            font-weight: 800;
            color: rgba(0,0,0,.82);
          }
          .duu-share-item:hover{ background: rgba(0,0,0,.04); }
          .duu-share-sep{ height:1px; background: rgba(0,0,0,.06); }

          @media (max-width: 576px){
            .duu-actions{
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <CardImage />

        <div className="card-body d-flex flex-column">
          <div className="duu-card-head">
            <Link to={productPath} className="duu-title-link">
              <h3 className={`m-0 ${layout === "fashion" ? "h5" : "h6"} duu-title`}>
                {String(anyP.name || "")}
              </h3>
            </Link>

            {!!anyP.description && (
              <p className="duu-desc">{shortText(String(anyP.description), miniDescMax)}</p>
            )}
          </div>

          <div className="duu-rating-row">
            <ProductRating productId={Number(anyP.id)} />
          </div>

          <PriceBlock />
          <VariantSelector />

          <div className="position-relative">
            <div className="duu-actions">
              <Link to={productPath} className="btn btn-outline-dark btn-sm">
                Voir
              </Link>

              {qtySelected > 0 ? (
                <div className="btn-group btn-group-sm duu-qty-group" role="group">
                  <button
                    className="btn btn-outline-dark"
                    onClick={handleDecrease}
                    type="button"
                  >
                    −
                  </button>
                  <button className="btn btn-light disabled" type="button">
                    {qtySelected}
                  </button>
                  <button
                    className="btn btn-duu"
                    onClick={handleAdd}
                    type="button"
                    disabled={!canAddNow}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-duu btn-sm"
                  onClick={handleAdd}
                  disabled={!canAddNow}
                  type="button"
                >
                  + Panier
                </button>
              )}
            </div>

            <div className="mt-2">
              <button
                className="btn btn-sm btn-outline-secondary w-100"
                onClick={(e) => {
                  e.stopPropagation();
                  shareProduct();
                }}
                type="button"
              >
                Partager
              </button>
            </div>

            {shareMenuOpen && (
              <div
                className="duu-share-pop"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.whatsapp)}
                  type="button"
                >
                  WhatsApp
                </button>
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.facebook)}
                  type="button"
                >
                  Facebook / Meta
                </button>
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.telegram)}
                  type="button"
                >
                  Telegram
                </button>
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.x)}
                  type="button"
                >
                  X (Twitter)
                </button>
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.linkedin)}
                  type="button"
                >
                  LinkedIn
                </button>
                <button
                  className="duu-share-item"
                  onClick={() => openShareLink(shareLinks.email)}
                  type="button"
                >
                  Email
                </button>

                <div className="duu-share-sep" />
                <button
                  className="duu-share-item"
                  onClick={async () => {
                    await copyShareUrl();
                    setShareMenuOpen(false);
                  }}
                  type="button"
                >
                  {copied ? "Lien copié ✅" : "Copier le lien"}
                </button>

                <div className="duu-share-sep" />
                {humanUrl ? (
                  <button
                    className="duu-share-item"
                    onClick={() => openShareLink(humanUrl)}
                    type="button"
                  >
                    Ouvrir la page produit
                  </button>
                ) : null}

                <div className="duu-share-sep" />
                <button
                  className="duu-share-item"
                  onClick={() => setShareMenuOpen(false)}
                  type="button"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>

          {hasVariants && qtyTotal > 0 ? (
            <div className="duu-footer-note">
              Total dans le panier : <strong>{qtyTotal}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {open && (
        <div
          className="modal d-block"
          style={{ background: "rgba(0,0,0,.35)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content" style={{ borderRadius: 18, border: "1px solid rgba(0,0,0,.06)" }}>
              <div className="modal-header">
                <h5 className="modal-title">{String(anyP.name || "")}</h5>
                <button
                  className="btn-close"
                  onClick={closeModal}
                  type="button"
                  aria-label="Fermer"
                />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="position-relative rounded overflow-hidden bg-light">
                      {currentImg ? (
                        <img
                          src={currentImg}
                          alt={String(anyP.name || "")}
                          className="w-100"
                          style={{ aspectRatio: "1/1", objectFit: "cover" }}
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-100" style={{ aspectRatio: "1/1" }} />
                      )}

                      {images.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-light position-absolute top-50 start-0 translate-middle-y ms-2"
                            onClick={prevImg}
                            aria-label="Image précédente"
                            style={{ boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y me-2"
                            onClick={nextImg}
                            aria-label="Image suivante"
                            style={{ boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                          >
                            ▶
                          </button>

                          <span
                            className="badge position-absolute bottom-0 end-0 m-2 text-white"
                            style={{ background: "rgba(17,17,17,.75)" }}
                          >
                            {imgIdx + 1}/{images.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-baseline gap-2 flex-wrap">
                      <div className="h5 m-0 fw-bold">{moneyMAD(displayPrice)}</div>
                      {effectiveOldPrice != null &&
                        toNum(effectiveOldPrice) > toNum(displayPrice) && (
                          <div
                            className="h6 m-0"
                            style={{
                              textDecoration: "line-through",
                              color: "rgba(0,0,0,.45)",
                            }}
                          >
                            {moneyMAD(effectiveOldPrice)}
                          </div>
                        )}
                    </div>

                    {effectiveBadgeText ? (
                      <div className="mt-2">
                        <span
                          className="badge text-white"
                          style={{ background: "var(--duu-red)", fontWeight: 900 }}
                        >
                          {effectiveBadgeText}
                        </span>
                      </div>
                    ) : null}

                    {stockText ? (
                      <div className="mt-2">
                        <span
                          className={`duu-stock-pill duu-stock-pill--${stockTone}`}
                        >
                          {stockText}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <ProductRating productId={Number(anyP.id)} />
                    </div>

                    <div className="mt-3">
                      <VariantSelector />
                    </div>

                    <p className="text-muted mt-3 mb-3">
                      {anyP.description
                        ? shortText(anyP.description, 520)
                        : "Aucune description."}
                    </p>

                    <div className="d-grid gap-2 position-relative">
                      <button
                        className="btn btn-duu fw-semibold"
                        onClick={handleAdd}
                        disabled={!canAddNow}
                        type="button"
                      >
                        + Ajouter au panier
                      </button>

                      <button
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          shareProduct();
                        }}
                        type="button"
                      >
                        Partager
                      </button>
                    </div>

                    {effectiveStock != null && effectiveStock <= 0 ? (
                      <div className="alert alert-warning mt-3 py-2 small mb-0">
                        Produit en rupture de stock.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-outline-dark"
                  onClick={closeModal}
                  type="button"
                >
                  Fermer
                </button>
                <Link to={productPath} className="btn btn-dark">
                  Voir la fiche
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
  if (prev.stockLabel !== next.stockLabel) return false;

  if ((prev.hideSubCategories?.join("|") || "") !== (next.hideSubCategories?.join("|") || ""))
    return false;

  return true;
}

export default React.memo(ProductCardInner, areEqual);
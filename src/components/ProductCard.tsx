// src/components/ProductCard.tsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
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

/**
 * ✅ MAD SANS afficher ",00"
 * - garde au max 2 décimales si nécessaire
 * - supprime automatiquement les zéros inutiles (",00", ",50" => ",5")
 */
function moneyMAD(n?: number | null) {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;

  const s = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);

  // fr-FR -> virgule décimale
  // supprime ",00" ou ",0" en fin
  const no00 = s.replace(/,00$/, "").replace(/,0$/, "");
  // supprime zéros traînants: ",50" -> ",5" ; ",20" -> ",2"
  const trimmed = no00.replace(/,(\d*[1-9])0$/, ",$1");

  return `${trimmed} MAD`;
}

function shortText(s?: string | null, max = 200) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function normToken(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

/**
 * ⚠️ IMPORTANT: on n'utilise PAS p.sub_category
 * On utilise: sub_category_slug / sub_category_name / sub_category_id
 */
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

/* =========================
 * URL Share (OG) — PUBLIC (www.duumini.com)
 * -> on partage www.duumini.com/share/product/:id
 * =======================*/
function cleanBase(x: string) {
  return String(x || "")
    .trim()
    .replace(/\/+$/, "");
}

/** ✅ Domaine PUBLIC du site (pas l'API). */
function getWebOriginForShare() {
  const fromEnv =
    (typeof import.meta !== "undefined" &&
      ((import.meta as any).env?.VITE_WEB_ORIGIN ||
        (import.meta as any).env?.VITE_SITE_ORIGIN)) ||
    "";

  const v = cleanBase(fromEnv);
  if (v) return v;

  // ✅ fallback demandé
  return "https://www.duumini.com";
}

/** ✅ URL OG (PUBLIC) => /share/product/:id */
function buildSharePageUrl(p: Product) {
  const web = getWebOriginForShare();
  const id = Number((p as any).id);
  if (!web || !id) return "";
  return `${web}/share/product/${id}`;
}

/** liens fallback (quand WebShare indispo) */
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

/* =========================
 * Share image helper (Web Share API files)
 * =======================*/
async function fetchAsFile(url: string, filename: string): Promise<File | null> {
  try {
    if (!url) return null;

    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || !blob.size) return null;

    // limite prudente
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

/* ✅ helper: prix base */
function getDisplayPrice(anyP: any, priceOverride: number | null) {
  if (priceOverride != null) return Number(priceOverride || 0);
  const pc = anyP.price_client ?? anyP.client_price ?? null;
  if (pc != null && pc !== "") return Number(pc || 0);
  return Number(anyP.price ?? 0);
}

/* =========================
 * PROMO (AUTO)
 * =======================*/
type PromoRule =
  | { kind: "PERCENT"; value: number }
  | { kind: "AMOUNT"; value: number }
  | { kind: "RATIO"; factor: number }
  | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePromoPriceFromRule(price: number, rule: PromoRule) {
  const p = Number(price || 0);
  if (!p || !rule) return p;

  if (rule.kind === "PERCENT") {
    const pct = clamp(Number(rule.value || 0), 0, 100);
    return Math.max(0, Number((p - (p * pct) / 100).toFixed(2)));
  }

  if (rule.kind === "AMOUNT") {
    const amt = Math.max(0, Number(rule.value || 0));
    return Math.max(0, Number((p - amt).toFixed(2)));
  }

  const f = clamp(Number(rule.factor || 1), 0, 1);
  return Math.max(0, Number((p * f).toFixed(2)));
}

function formatPromoBadge(rule: PromoRule, base: number, promo: number) {
  if (!rule) return "PROMO";
  if (rule.kind === "PERCENT") return `PROMO -${Math.round(rule.value)}%`;
  if (rule.kind === "AMOUNT") return `PROMO -${moneyMAD(rule.value)}`;
  if (base > 0 && promo >= 0 && promo < base) {
    const pct = Math.round(((base - promo) / base) * 100);
    if (pct > 0) return `PROMO -${pct}%`;
  }
  return "PROMO";
}

function getPromoMeta(anyP: any, basePrice: number) {
  const base = Number(basePrice || 0);
  if (!base)
    return {
      isPromo: false,
      rule: null as PromoRule,
      oldPrice: null as number | null,
      badgeText: null as string | null,
    };

  const flag =
    anyP.is_promo === true ||
    anyP.promo === true ||
    anyP.on_promo === true ||
    Number(anyP.promo_eligible ?? 0) === 1;

  const promoPriceDirect =
    Number(
      anyP.promo_price_client ??
        anyP.promo_price ??
        anyP.price_promo ??
        anyP.sale_price ??
        0
    ) || 0;

  if (promoPriceDirect > 0 && promoPriceDirect < base) {
    const factor = clamp(promoPriceDirect / base, 0, 1);
    const rule: PromoRule = { kind: "RATIO", factor };
    return {
      isPromo: true,
      rule,
      oldPrice: base,
      badgeText: formatPromoBadge(rule, base, promoPriceDirect),
    };
  }

  const typeRaw = String(
    anyP.promo_discount_type ?? anyP.discount_type ?? anyP.promo_type ?? ""
  )
    .trim()
    .toUpperCase();

  const valueRaw =
    Number(
      anyP.promo_discount_value ??
        anyP.discount_value ??
        anyP.promo_value ??
        0
    ) || 0;

  if (
    valueRaw > 0 &&
    (typeRaw === "PERCENT" || typeRaw === "PCT" || typeRaw === "%")
  ) {
    const rule: PromoRule = {
      kind: "PERCENT",
      value: clamp(valueRaw, 0, 100),
    };
    const promo = computePromoPriceFromRule(base, rule);
    if (promo < base) {
      return {
        isPromo: true,
        rule,
        oldPrice: base,
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
        oldPrice: base,
        badgeText: formatPromoBadge(rule, base, promo),
      };
    }
  }

  if (flag)
    return { isPromo: false, rule: null, oldPrice: null, badgeText: null };
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
    const price = po == null || po === "" ? null : Number(po);

    const stockRaw = v?.stock ?? v?.qty ?? null;
    const stock = stockRaw == null || stockRaw === "" ? null : Number(stockRaw);

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

  const promoMeta = useMemo(
    () => getPromoMeta(anyP, baseDisplayPrice),
    [anyP, baseDisplayPrice]
  );
  const effectiveRule = promoMeta.isPromo ? promoMeta.rule : null;

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
      const firstOk = variants.find((v) => !isVariantOutOfStock(v)) || variants[0];
      return firstOk?.key || "";
    });
  }, [hasVariants, variants]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.key === selectedKey) || null,
    [variants, selectedKey]
  );

  const rawPrice = useMemo(() => {
    if (selectedVariant?.price != null) return Number(selectedVariant.price);
    return baseDisplayPrice;
  }, [baseDisplayPrice, selectedVariant]);

  const displayPrice = useMemo(
    () => computePromoPriceFromRule(rawPrice, effectiveRule),
    [rawPrice, effectiveRule]
  );

  const effectiveOldPrice = useMemo(() => {
    if (oldPrice != null && Number(oldPrice) > Number(displayPrice))
      return Number(oldPrice);
    if (promoMeta.isPromo && rawPrice > displayPrice) return rawPrice;
    return null;
  }, [displayPrice, oldPrice, promoMeta.isPromo, rawPrice]);

  const effectiveBadgeText = useMemo(() => {
    if (badgeText) return badgeText;
    if (promoMeta.isPromo) return promoMeta.badgeText || "PROMO";
    return null;
  }, [badgeText, promoMeta.badgeText, promoMeta.isPromo]);

  const effectiveStock = useMemo(() => {
    if (hasVariants && selectedVariant?.stock != null) return selectedVariant.stock;
    return baseStock;
  }, [baseStock, hasVariants, selectedVariant]);

  const stockText = useMemo(() => {
    if (effectiveStock == null) return "";
    if (effectiveStock <= 0) return "En rupture";
    return `${stockLabel}:${effectiveStock}`;
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
        !isDefault && variant?.price != null ? Number(variant.price) : baseDisplayPrice;
      const finalPrice = computePromoPriceFromRule(raw, effectiveRule);

      const productForCart: any = {
        ...anyP,
        price: finalPrice,
        _pricing: {
          rawPrice: raw,
          finalPrice,
          isPromo: finalPrice < raw,
          badge: effectiveBadgeText ?? null,
          oldPrice: finalPrice < raw ? raw : null,
        },
      };

      add(productForCart, delta, {
        variant: isDefault
          ? { variant_id: null, variant_key: "default", label: null, price: finalPrice }
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
    ]
  );

  const handleAdd = useCallback(() => {
    addWithVariant(hasVariants ? selectedVariant : null, 1);
  }, [addWithVariant, hasVariants, selectedVariant]);

  const handleDecrease = useCallback(() => {
    if (!qtySelected) return;
    addWithVariant(hasVariants ? selectedVariant : null, -1);
  }, [addWithVariant, hasVariants, qtySelected, selectedVariant]);

  /* =========================
   * Partage (PUBLIC www + image + lien)
   * =======================*/
  const shareUrl = useMemo(() => buildSharePageUrl(product), [product]);

  const shareTitle = useMemo(() => {
    const name = String(anyP.name || "Produit");
    if (effectiveOldPrice != null && Number(effectiveOldPrice) > Number(displayPrice)) {
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
    } catch {
      // silencieux
    }
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

    // 🖼️ best-effort: image + lien (si supporté)
    const img = coverUrl || currentImg || "";
    if (navAny?.share && img) {
      const file = await fetchAsFile(
        img,
        `duumini-${Number(anyP.id || 0) || "product"}.jpg`
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
        } catch {
          // fallback ci-dessous
        }
      }
    }

    // 🔗 fallback: share texte + lien
    if (navAny?.share) {
      try {
        await navAny.share({
          title: String(anyP.name || "Duumini"),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // ignore
      }
    }

    // menu fallback
    setShareMenuOpen(true);
  }, [anyP.id, anyP.name, coverUrl, currentImg, shareText, shareUrl]);

  /* ===== Image swiper (CARD VIEW) ===== */
  const CardImageSwiper = ({
    variant = "square",
    minHeight,
  }: {
    variant?: "square" | "fashion";
    minHeight?: number;
  }) => {
    const hasMany = images.length > 1;
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [active, setActive] = useState(0);

    const dragRef = useRef({ downX: 0, downY: 0, dragging: false });
    const onPointerDown = (e: React.PointerEvent) => {
      dragRef.current.downX = e.clientX;
      dragRef.current.downY = e.clientY;
      dragRef.current.dragging = false;
    };
    const onPointerMove = (e: React.PointerEvent) => {
      const dx = Math.abs(e.clientX - dragRef.current.downX);
      const dy = Math.abs(e.clientY - dragRef.current.downY);
      if (dx > 8 && dx > dy) dragRef.current.dragging = true;
    };
    const onClickSlide = (idx: number) => {
      if (dragRef.current.dragging) return;
      openModal(idx);
    };

    const onScroll = useCallback(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const w = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / w);
      if (Number.isFinite(idx))
        setActive(Math.max(0, Math.min(idx, images.length - 1)));
    }, [images.length]);

    const jumpTo = (idx: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const w = el.clientWidth || 1;
      el.scrollTo({ left: idx * w, behavior: "smooth" });
    };

    if (!coverUrl) {
      return variant === "square" ? (
        <div className="w-100 bg-light" style={{ aspectRatio: "1/1" }} />
      ) : (
        <div className="duu-fashion-img" />
      );
    }

    const ImgTag = ({
      src,
      className,
      style,
      alt,
      onClick,
    }: {
      src: string;
      className?: string;
      style?: React.CSSProperties;
      alt: string;
      onClick?: () => void;
    }) => (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading="lazy"
        decoding="async"
        draggable={false}
        onClick={onClick}
      />
    );

    if (!hasMany) {
      if (variant === "square") {
        return (
          <ImgTag
            src={coverUrl}
            alt={String(anyP.name || "")}
            className="w-100"
            style={{
              aspectRatio: "1/1",
              objectFit: "cover",
              cursor: "pointer",
            }}
            onClick={() => openModal(0)}
          />
        );
      }
      return (
        <ImgTag
          src={coverUrl}
          alt={String(anyP.name || "")}
          className="duu-fashion-img"
          style={{ cursor: "pointer", minHeight: minHeight ?? undefined }}
          onClick={() => openModal(0)}
        />
      );
    }

    return (
      <div className="duu-swipe-wrap position-relative">
        <div
          ref={scrollerRef}
          className="duu-swipe"
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          {images.map((u, i) => (
            <button
              key={u + i}
              type="button"
              className="duu-swipe-slide"
              onClick={() => onClickSlide(i)}
              aria-label={`Voir image ${i + 1}`}
              title={`Image ${i + 1}`}
            >
              <ImgTag
                src={u}
                alt={String(anyP.name || "")}
                className={
                  variant === "square"
                    ? "duu-swipe-img-square"
                    : "duu-swipe-img-fashion"
                }
              />
            </button>
          ))}
        </div>

        <div className="duu-swipe-dots">
          {images.slice(0, 8).map((_, i) => (
            <button
              key={i}
              type="button"
              className={"duu-dot " + (i === active ? "active" : "")}
              onClick={() => jumpTo(i)}
              aria-label={`Aller à l'image ${i + 1}`}
              title={`Image ${i + 1}`}
            />
          ))}
        </div>

        <span
          className="badge position-absolute bottom-0 end-0 m-2 text-white"
          style={{ background: "rgba(17,17,17,.75)" }}
        >
          {active + 1}/{images.length}
        </span>

        <style>{`
          .duu-swipe-wrap{ background:#f5f5f5; }
          .duu-swipe{
            display:flex;
            overflow-x:auto;
            scroll-snap-type:x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .duu-swipe::-webkit-scrollbar{ display:none; }
          .duu-swipe-slide{
            all: unset;
            flex: 0 0 100%;
            width: 100%;
            scroll-snap-align: start;
            cursor: pointer;
          }
          .duu-swipe-img-square{
            width: 100%;
            height: auto;
            aspect-ratio: 1 / 1;
            object-fit: cover;
            display:block;
            user-select:none;
            -webkit-user-drag:none;
          }
          .duu-swipe-img-fashion{
            width: 100%;
            height: 100%;
            min-height: ${minHeight ?? 190}px;
            object-fit: cover;
            display:block;
            user-select:none;
            -webkit-user-drag:none;
          }
          .duu-swipe-dots{
            position:absolute;
            left: 50%;
            transform: translateX(-50%);
            bottom: 8px;
            display:flex;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 999px;
            background: rgba(255,255,255,.75);
            backdrop-filter: blur(6px);
          }
          .duu-dot{
            all: unset;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(0,0,0,.25);
            cursor: pointer;
          }
          .duu-dot.active{ background: rgba(0,0,0,.70); }
        `}</style>
      </div>
    );
  };

  const VariantSelector = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    if (!hasVariants) return null;

    const selected = selectedVariant;

    const optionLabel = (v: UiVariant) => {
      const sc = [v.size || null, v.color || null].filter(Boolean).join(" · ");
      return sc || v.label;
    };

    const qv = selected ? qtyForProductVariant(Number(anyP.id), selected.key) : 0;

    const infoParts: string[] = [];
    if (selected?.stock != null) infoParts.push(`${stockLabel}:${selected.stock}`);
    else if (effectiveStock != null) infoParts.push(`${stockLabel}:${effectiveStock}`);

    const raw = selected?.price != null ? selected.price : null;
    if (raw != null) {
      const final = computePromoPriceFromRule(raw, effectiveRule);
      infoParts.push(`Prix:${moneyMAD(final)}`);
      const old = final < raw ? raw : null;
      if (old != null) infoParts.push(`Ancien:${moneyMAD(old)}`);
    }

    const infoLine = infoParts.join(" • ");

    return (
      <div className={size === "sm" ? "mt-2" : "mt-3"}>
        <div className="d-flex align-items-center justify-content-between">
          <div className="small text-muted fw-semibold">Variante</div>
          {qv > 0 ? (
            <div className="small fw-bold" style={{ color: "var(--duu-black)" }}>
              Dans le panier : {qv}
            </div>
          ) : null}
        </div>

        <select
          className="form-select form-select-sm mt-2"
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

        {infoLine ? (
          <div className="small mt-2" style={{ color: "rgba(0,0,0,.65)", fontWeight: 800 }}>
            {infoLine}
          </div>
        ) : null}

        {selected && isVariantOutOfStock(selected) ? (
          <div className="alert alert-warning mt-2 py-2 small mb-0">
            Cette variante est en rupture.
          </div>
        ) : null}

        <div className="mt-2 d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            onClick={() => selected && addWithVariant(selected, -1)}
            disabled={!selected || qv <= 0}
          >
            −
          </button>
          <button type="button" className="btn btn-light btn-sm" disabled>
            {qv || 0}
          </button>
          <button
            type="button"
            className="btn btn-duu btn-sm"
            onClick={() => selected && addWithVariant(selected, +1)}
            disabled={!selected || isVariantOutOfStock(selected)}
          >
            +
          </button>
        </div>

        <style>{`
          .form-select:focus{
            outline: none !important;
            box-shadow: 0 0 0 .22rem rgba(255,213,79,.40) !important;
            border-color: rgba(229,57,53,.35) !important;
          }
          .btn-duu{ background: var(--duu-yellow); color: #1f1f1f; border: none; }
          .btn-duu:hover{ filter: brightness(0.95); }
        `}</style>
      </div>
    );
  };

  const PriceStockLine = () => (
    <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
      <div className="fw-semibold">Prix:{moneyMAD(displayPrice)}</div>

      {effectiveOldPrice != null && Number(effectiveOldPrice) > Number(displayPrice) && (
        <div style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)", fontWeight: 800 }}>
          {moneyMAD(effectiveOldPrice)}
        </div>
      )}

      {stockText ? (
        <span
          className={
            "badge " +
            (effectiveStock != null && effectiveStock <= 0 ? "bg-danger" : "bg-light text-dark")
          }
          style={{ border: "1px solid rgba(0,0,0,.10)", fontWeight: 900 }}
        >
          {stockText}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <div
        className={
          "card border-0 shadow-sm " +
          (layout === "fashion" ? "duu-fashion-card h-100" : "h-100")
        }
      >
        <style>{`
          .btn-duu{ background: var(--duu-yellow); color:#1f1f1f; border:none; }
          .btn-duu:hover{ filter: brightness(0.95); }
          .duu-fashion-card{ border-radius: 16px; overflow: hidden; }
          .duu-fashion-row{ display:flex; gap:10px; height:100%; }
          .duu-fashion-media{ flex:0 0 56%; max-width:56%; position:relative; display:flex; flex-direction:column; }
          .duu-fashion-img{ width:100%; height:100%; min-height:190px; object-fit:cover; background:#f5f5f5; }
          .duu-fashion-side{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; padding:12px; }
          .duu-fashion-title{
            font-weight:900; color:var(--duu-black); line-height:1.1; margin:0;
            display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          }
          .duu-mini-desc-btn{
            all:unset; cursor:pointer; margin-top:6px; color:rgba(0,0,0,.62);
            font-weight:600; font-size:.86rem; line-height:1.15;
            display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
          }
          .duu-mini-desc-btn:hover{ color:rgba(0,0,0,.80); text-decoration:underline; }
          .duu-mini-desc-btn:focus,.duu-mini-desc-btn:focus-visible{
            outline:none !important; box-shadow:0 0 0 .22rem rgba(255,213,79,.40) !important; border-radius:10px;
          }

          .duu-share-pop{
            position: absolute;
            right: 0;
            top: calc(100% + 8px);
            z-index: 30;
            width: 260px;
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
            font-weight: 700;
            color: rgba(0,0,0,.82);
          }
          .duu-share-item:hover{ background: rgba(0,0,0,.04); }
          .duu-share-sep{ height:1px; background: rgba(0,0,0,.06); }

          @media (max-width: 992px){
            .duu-fashion-media{ flex:0 0 52%; max-width:52%; }
            .duu-fashion-img{ min-height:180px; }
          }
          @media (max-width: 576px){
            .duu-fashion-row{ flex-direction: column; }
            .duu-fashion-media{ flex:0 0 auto; max-width:100%; }
            .duu-fashion-img{ min-height:230px; }
          }
        `}</style>

        {layout === "fashion" ? (
          <div className="duu-fashion-row">
            <div className="duu-fashion-media">
              <div className="position-relative">
                <CardImageSwiper variant="fashion" minHeight={190} />

                {effectiveStock != null && effectiveStock <= 0 && (
                  <span className="badge bg-danger position-absolute top-0 start-0 m-2">
                    En rupture
                  </span>
                )}

                {!!effectiveBadgeText && !(effectiveStock != null && effectiveStock <= 0) && (
                  <span
                    className="badge position-absolute top-0 end-0 m-2 text-white"
                    style={{ background: "var(--duu-red)" }}
                  >
                    {effectiveBadgeText}
                  </span>
                )}
              </div>
            </div>

            <div className="duu-fashion-side">
              <button
                className="btn btn-link p-0 text-start"
                onClick={() => openModal(0)}
                type="button"
                style={{ textDecoration: "none" }}
              >
                <h3 className="duu-fashion-title">{String(anyP.name || "")}</h3>
              </button>

              {!!anyP.description && (
                <button
                  type="button"
                  className="duu-mini-desc-btn"
                  onClick={() => openModal(0)}
                >
                  {shortText(String(anyP.description), miniDescMax)}
                </button>
              )}

              <div className="mt-2">
                <ProductRating productId={Number(anyP.id)} />
              </div>

              <PriceStockLine />
              <VariantSelector size="sm" />

              <div className="mt-auto d-flex gap-2 pt-3 position-relative">
                <button
                  className="btn btn-outline-dark btn-sm flex-fill"
                  onClick={() => openModal(0)}
                  type="button"
                >
                  Voir
                </button>

                {qtySelected > 0 ? (
                  <div className="btn-group btn-group-sm flex-fill" role="group">
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
                    className="btn btn-duu btn-sm flex-fill"
                    onClick={handleAdd}
                    disabled={!canAddNow}
                    type="button"
                  >
                    + Panier
                  </button>
                )}

                {/* ✅ Supprimé: bouton "↗" (flèche partager) */}
                {/* Le partage reste dispo uniquement dans le MODAL via le bouton "Partager". */}
              </div>

              {hasVariants && qtyTotal > 0 && (
                <div className="small text-muted mt-2" style={{ lineHeight: 1.1 }}>
                  Total dans le panier : <strong>{qtyTotal}</strong>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="position-relative">
              <CardImageSwiper variant="square" />

              {effectiveStock != null && effectiveStock <= 0 && (
                <span className="badge bg-danger position-absolute top-0 start-0 m-2">
                  En rupture
                </span>
              )}

              {!!effectiveBadgeText && !(effectiveStock != null && effectiveStock <= 0) && (
                <span
                  className="badge position-absolute top-0 end-0 m-2 text-white"
                  style={{ background: "var(--duu-red)" }}
                >
                  {effectiveBadgeText}
                </span>
              )}
            </div>

            <div className="card-body d-flex flex-column">
              <h3 className="h6 mb-1">
                <button
                  className="btn btn-link p-0 text-start text-dark"
                  onClick={() => openModal(0)}
                  type="button"
                  style={{ textDecoration: "none" }}
                >
                  {String(anyP.name || "")}
                </button>
              </h3>

              {!!anyP.description && (
                <button
                  type="button"
                  onClick={() => openModal(0)}
                  className="btn btn-link p-0 text-start"
                  style={{
                    textDecoration: "none",
                    color: "rgba(0,0,0,.62)",
                    fontWeight: 600,
                    fontSize: ".86rem",
                  }}
                >
                  {shortText(String(anyP.description), miniDescMax)}
                </button>
              )}

              <div className="mb-1 mt-1">
                <ProductRating productId={Number(anyP.id)} />
              </div>

              <PriceStockLine />
              <VariantSelector size="sm" />

              <div className="mt-auto d-flex gap-2 pt-3 position-relative">
                <button
                  className="btn btn-outline-dark btn-sm flex-fill"
                  onClick={() => openModal(0)}
                  type="button"
                >
                  Voir
                </button>

                {qtySelected > 0 ? (
                  <div className="btn-group btn-group-sm flex-fill" role="group">
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
                    className="btn btn-duu btn-sm flex-fill"
                    onClick={handleAdd}
                    disabled={!canAddNow}
                    type="button"
                  >
                    + Panier
                  </button>
                )}

                {/* ✅ Supprimé: bouton "↗" (flèche partager) */}
                {/* Le partage reste dispo uniquement dans le MODAL via le bouton "Partager". */}
              </div>

              {hasVariants && qtyTotal > 0 && (
                <div className="small text-muted mt-2" style={{ lineHeight: 1.1 }}>
                  Total dans le panier (toutes variantes) :{" "}
                  <strong>{qtyTotal}</strong>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* =========================
       * MODAL (Partage via lien /share/product/:id)
       * =======================*/}
      {open && (
        <div
          className="modal d-block"
          style={{ background: "rgba(0,0,0,.35)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
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
                    <div className="d-flex align-items-baseline gap-2">
                      <div className="h5 m-0">Prix:{moneyMAD(displayPrice)}</div>
                      {effectiveOldPrice != null &&
                        Number(effectiveOldPrice) > Number(displayPrice) && (
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

                    {!!effectiveBadgeText && (
                      <div className="mt-2">
                        <span
                          className="badge text-white"
                          style={{ background: "var(--duu-red)", fontWeight: 900 }}
                        >
                          {effectiveBadgeText}
                        </span>
                      </div>
                    )}

                    {stockText ? (
                      <div className="mt-2">
                        <span
                          className={
                            "badge " +
                            (effectiveStock != null && effectiveStock <= 0
                              ? "bg-danger"
                              : "bg-light text-dark")
                          }
                          style={{ border: "1px solid rgba(0,0,0,.10)", fontWeight: 900 }}
                        >
                          {stockText}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-2">
                      <ProductRating productId={Number(anyP.id)} />
                    </div>

                    <VariantSelector size="md" />

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

                    {effectiveStock != null && effectiveStock <= 0 && (
                      <div className="alert alert-warning mt-3 py-2 small mb-0">
                        Produit en rupture de stock.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={closeModal} type="button">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================
 * React.memo: stop rerenders inutiles (iOS)
 * =======================*/
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

  // onAdd peut changer à chaque render -> on l'ignore pour ne pas déclencher de rerender
  return true;
}

export default React.memo(ProductCardInner, areEqual);

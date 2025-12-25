// src/components/ProductCard.tsx
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { Product } from "../services/products";
import { API_BASE } from "../services/http";
import { useCart } from "../store/cart";
import ProductRating from "./ProductRating";
import { trackAddToCart } from "../lib/analytics";

/* ===== Helpers ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

function moneyMAD(n?: number | null) {
  const v = Number(n || 0);
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MAD`;
}

function shortText(s?: string | null, max = 200) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
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

/* ===== Partage ===== */
function buildSharePageUrl(p: Product) {
  const shareBase =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHARE_BASE_URL) ||
    "https://www.duumini.com";
  return `${shareBase}/share/product/${Number((p as any).id)}`;
}

function buildShareLinks(shareUrl: string, title: string) {
  const u = encodeURIComponent(shareUrl);
  const t = encodeURIComponent(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`,
    email: `mailto:?subject=${t}&body=${t}%0A${u}`,
  };
}

/* ✅ helper: prix affiché (promo / override / compat backend) */
function getDisplayPrice(anyP: any, priceOverride: number | null) {
  if (priceOverride != null) return Number(priceOverride || 0);
  const pc = anyP.price_client ?? anyP.client_price ?? null;
  if (pc != null && pc !== "") return Number(pc || 0);
  return Number(anyP.price ?? 0);
}

/* ===== Variantes (générique) ===== */
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

/* ===== Component ===== */
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

export default function ProductCard({
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
  const baseStock = baseStockRaw == null || baseStockRaw === "" ? null : Number(baseStockRaw);

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

  const baseDisplayPrice = useMemo(() => getDisplayPrice(anyP, priceOverride), [anyP, priceOverride]);

  const shareUrl = useMemo(() => buildSharePageUrl(product), [product]);
  const shareTitle = useMemo(() => `${String(anyP.name || "Produit")} — ${moneyMAD(baseDisplayPrice)} sur Duumini`, [anyP.name, baseDisplayPrice]);
  const shareLinks = useMemo(() => buildShareLinks(shareUrl, shareTitle), [shareUrl, shareTitle]);

  const variants = useMemo(() => parseVariants(product), [product]);
  const hasVariants = variants.length > 0;

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

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

  const selectedVariant = useMemo(() => variants.find((v) => v.key === selectedKey) || null, [variants, selectedKey]);

  const displayPrice = useMemo(() => {
    if (selectedVariant?.price != null) return Number(selectedVariant.price);
    return baseDisplayPrice;
  }, [baseDisplayPrice, selectedVariant]);

  const effectiveStock = useMemo(() => {
    if (hasVariants && selectedVariant?.stock != null) return selectedVariant.stock;
    return baseStock;
  }, [baseStock, hasVariants, selectedVariant]);

  const stockText = useMemo(() => {
    if (effectiveStock == null) return "";
    if (effectiveStock <= 0) return "En rupture";
    return `${stockLabel}:${effectiveStock}`;
  }, [effectiveStock, stockLabel]);

  const qtyTotal = useMemo(() => qtyForProduct(Number(anyP.id)), [anyP.id, qtyForProduct]);

  const qtySelected = useMemo(() => {
    if (!hasVariants) return qtyTotal;
    const key = selectedVariant?.key || "default";
    return qtyForProductVariant(Number(anyP.id), key);
  }, [anyP.id, hasVariants, qtyForProductVariant, qtyTotal, selectedVariant]);

  // ✅ open modal en démarrant sur l'image cliquée
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

  const requireVariantOrOpen = useCallback(() => {
    if (!hasVariants) return true;
    if (selectedVariant) return true;
    openModal(0);
    return false;
  }, [hasVariants, openModal, selectedVariant]);

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

      const finalPrice = !isDefault && variant?.price != null ? Number(variant.price) : baseDisplayPrice;

      const productForCart: any = {
        ...anyP,
        price: finalPrice,
        _pricing: {
          basePrice: Number(anyP.price ?? 0),
          finalPrice,
          isPromo: priceOverride != null && oldPrice != null && Number(oldPrice) > Number(finalPrice),
          badge: badgeText ?? null,
        },
      };

      add(productForCart, delta, {
        variant: isDefault
          ? { variant_id: null, variant_key: "default", label: null, price: finalPrice }
          : { variant_id: variant!.id, variant_key: variant!.key, label: variant!.label, price: variant!.price ?? finalPrice },
      });

      if (delta > 0) {
        if (onAdd) onAdd(productForCart);
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
    [add, anyP, badgeText, baseDisplayPrice, baseStock, hasVariants, oldPrice, onAdd, priceOverride, subCatToken]
  );

  const handleAdd = useCallback(() => {
    if (!requireVariantOrOpen()) return;
    addWithVariant(hasVariants ? selectedVariant : null, 1);
  }, [addWithVariant, hasVariants, requireVariantOrOpen, selectedVariant]);

  const handleDecrease = useCallback(() => {
    if (!qtySelected) return;
    addWithVariant(hasVariants ? selectedVariant : null, -1);
  }, [addWithVariant, hasVariants, qtySelected, selectedVariant]);

  /* =========================
   * Share (ALL platforms)
   * - 1) Web Share API (try with image)
   * - 2) Web Share API (no files)
   * - 3) Open share menu (links) + copy
   * ========================= */
  const shareProduct = useCallback(async () => {
    // 1) Mobile share with image (best for Instagram/WhatsApp share sheets)
    try {
      const navAny: any = navigator as any;
      if (navAny?.share && currentImg) {
        try {
          const r = await fetch(currentImg, { mode: "cors" });
          const blob = await r.blob();
          const ext = blob.type.includes("png") ? "png" : "jpg";
          const file = new File([blob], `duumini-${Number(anyP.id)}.${ext}`, { type: blob.type || "image/jpeg" });

          if (navAny?.canShare?.({ files: [file] })) {
            await navAny.share({
              title: String(anyP.name || "Duumini"),
              text: shareTitle,
              url: shareUrl,
              files: [file],
            });
            return;
          }
        } catch {
          // ignore, fallback below
        }

        // 2) Web share without files
        await navAny.share({ title: String(anyP.name || "Duumini"), text: shareTitle, url: shareUrl });
        return;
      }
    } catch {
      // ignore, fallback below
    }

    // 3) Desktop fallback menu
    setShareMenuOpen(true);
  }, [anyP.id, anyP.name, currentImg, shareTitle, shareUrl]);

  const copyShareUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [shareUrl]);

  const openShareLink = useCallback((u: string) => {
    window.open(u, "_blank", "noopener,noreferrer");
  }, []);

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

    // empêcher "click" quand l'utilisateur swipe
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
      if (Number.isFinite(idx)) setActive(Math.max(0, Math.min(idx, images.length - 1)));
    }, [images.length]);

    const jumpTo = (idx: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const w = el.clientWidth || 1;
      el.scrollTo({ left: idx * w, behavior: "smooth" });
    };

    // index visuel pour thumbs sous carte
    useEffect(() => {
      if (!open) setImgIdx(active);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    if (!coverUrl) {
      return variant === "square" ? (
        <div className="w-100 bg-light" style={{ aspectRatio: "1/1" }} />
      ) : (
        <div className="duu-fashion-img" />
      );
    }

    // une seule image => simple
    if (!hasMany) {
      if (variant === "square") {
        return (
          <img
            src={coverUrl}
            alt={String(anyP.name || "")}
            className="w-100"
            style={{ aspectRatio: "1/1", objectFit: "cover", cursor: "pointer" }}
            loading="lazy"
            onClick={() => openModal(0)}
          />
        );
      }
      return (
        <img
          src={coverUrl}
          alt={String(anyP.name || "")}
          className="duu-fashion-img"
          loading="lazy"
          style={{ cursor: "pointer", minHeight: minHeight ?? undefined }}
          onClick={() => openModal(0)}
        />
      );
    }

    // plusieurs images => swipe
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
              <img
                src={u}
                alt={String(anyP.name || "")}
                className={variant === "square" ? "duu-swipe-img-square" : "duu-swipe-img-fashion"}
                loading="lazy"
                draggable={false}
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

        <span className="badge position-absolute bottom-0 end-0 m-2 text-white" style={{ background: "rgba(17,17,17,.75)" }}>
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

  /* ✅ Thumbnails sous la carte (mini-images) */
  const CardThumbStrip = ({ max = 5 }: { max?: number }) => {
    if (images.length <= 1) return null;
    const list = images.slice(0, max);

    return (
      <div className="duu-thumbs px-2 pb-2">
        <div className="d-flex gap-2 align-items-center">
          {list.map((u, i) => {
            const activeThumb = i === imgIdx;
            return (
              <button
                key={u + i}
                type="button"
                onClick={() => openModal(i)}
                className={"duu-thumb-btn border rounded overflow-hidden " + (activeThumb ? "border-dark" : "border-0")}
                aria-label={`Voir image ${i + 1}`}
                title={`Image ${i + 1}`}
              >
                <img src={u} alt="" className="duu-thumb-img" loading="lazy" />
              </button>
            );
          })}

          {images.length > max && (
            <button
              type="button"
              className="btn btn-sm btn-light ms-auto"
              onClick={() => openModal(0)}
              style={{ fontWeight: 900 }}
              title="Voir toutes les images"
            >
              +{images.length - max}
            </button>
          )}
        </div>

        <style>{`
          .duu-thumb-btn{
            width: 44px;
            height: 44px;
            padding: 0;
            background: #fff;
            box-shadow: 0 2px 10px rgba(0,0,0,.06);
          }
          .duu-thumb-img{
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
        `}</style>
      </div>
    );
  };

  /* ===== Variant Selector (dropdown) ===== */
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

    const p = selected?.price != null ? selected.price : null;
    if (p != null) infoParts.push(`Prix:${moneyMAD(p)}`);

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
          <div className="alert alert-warning mt-2 py-2 small mb-0">Cette variante est en rupture.</div>
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
          .btn-duu{
            background: var(--duu-yellow);
            color: #1f1f1f;
            border: none;
          }
          .btn-duu:hover{ filter: brightness(0.95); }
        `}</style>
      </div>
    );
  };

  /* ===== UI Price + Stock row ===== */
  const PriceStockLine = () => (
    <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
      <div className="fw-semibold">Prix:{moneyMAD(displayPrice)}</div>

      {oldPrice != null && Number(oldPrice) > Number(displayPrice) && (
        <div style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)", fontWeight: 800 }}>
          {moneyMAD(oldPrice)}
        </div>
      )}

      {stockText ? (
        <span
          className={"badge " + (effectiveStock != null && effectiveStock <= 0 ? "bg-danger" : "bg-light text-dark")}
          style={{ border: "1px solid rgba(0,0,0,.10)", fontWeight: 900 }}
        >
          {stockText}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <div className={"card border-0 shadow-sm " + (layout === "fashion" ? "duu-fashion-card h-100" : "h-100")}>
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
                  <span className="badge bg-danger position-absolute top-0 start-0 m-2">En rupture</span>
                )}

                {!!badgeText && !(effectiveStock != null && effectiveStock <= 0) && (
                  <span className="badge position-absolute top-0 end-0 m-2 text-white" style={{ background: "var(--duu-red)" }}>
                    {badgeText}
                  </span>
                )}
              </div>

              <CardThumbStrip max={5} />
            </div>

            <div className="duu-fashion-side">
              <button className="btn btn-link p-0 text-start" onClick={() => openModal(0)} type="button" style={{ textDecoration: "none" }}>
                <h3 className="duu-fashion-title">{String(anyP.name || "")}</h3>
              </button>

              {!!anyP.description && (
                <button type="button" className="duu-mini-desc-btn" onClick={() => openModal(0)}>
                  {shortText(String(anyP.description), miniDescMax)}
                </button>
              )}

              <div className="mt-2">
                <ProductRating productId={Number(anyP.id)} />
              </div>

              <PriceStockLine />
              <VariantSelector size="sm" />

              <div className="mt-auto d-flex gap-2 pt-3">
                <button className="btn btn-outline-dark btn-sm flex-fill" onClick={() => openModal(0)} type="button">
                  Voir
                </button>

                {qtySelected > 0 ? (
                  <div className="btn-group btn-group-sm flex-fill" role="group">
                    <button className="btn btn-outline-dark" onClick={handleDecrease} type="button">−</button>
                    <button className="btn btn-light disabled" type="button">{qtySelected}</button>
                    <button className="btn btn-duu" onClick={handleAdd} type="button" disabled={!canAddNow}>+</button>
                  </div>
                ) : (
                  <button className="btn btn-duu btn-sm flex-fill" onClick={handleAdd} disabled={!canAddNow} type="button">
                    + Panier
                  </button>
                )}
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
                <span className="badge bg-danger position-absolute top-0 start-0 m-2">En rupture</span>
              )}

              {!!badgeText && !(effectiveStock != null && effectiveStock <= 0) && (
                <span className="badge position-absolute top-0 end-0 m-2 text-white" style={{ background: "var(--duu-red)" }}>
                  {badgeText}
                </span>
              )}
            </div>

            <CardThumbStrip max={5} />

            <div className="card-body d-flex flex-column">
              <h3 className="h6 mb-1">
                <button className="btn btn-link p-0 text-start text-dark" onClick={() => openModal(0)} type="button" style={{ textDecoration: "none" }}>
                  {String(anyP.name || "")}
                </button>
              </h3>

              {!!anyP.description && (
                <button
                  type="button"
                  onClick={() => openModal(0)}
                  className="btn btn-link p-0 text-start"
                  style={{ textDecoration: "none", color: "rgba(0,0,0,.62)", fontWeight: 600, fontSize: ".86rem" }}
                >
                  {shortText(String(anyP.description), miniDescMax)}
                </button>
              )}

              <div className="mb-1 mt-1">
                <ProductRating productId={Number(anyP.id)} />
              </div>

              <PriceStockLine />
              <VariantSelector size="sm" />

              <div className="mt-auto d-flex gap-2 pt-3">
                <button className="btn btn-outline-dark btn-sm flex-fill" onClick={() => openModal(0)} type="button">
                  Voir
                </button>

                {qtySelected > 0 ? (
                  <div className="btn-group btn-group-sm flex-fill" role="group">
                    <button className="btn btn-outline-dark" onClick={handleDecrease} type="button">−</button>
                    <button className="btn btn-light disabled" type="button">{qtySelected}</button>
                    <button className="btn btn-duu" onClick={handleAdd} type="button" disabled={!canAddNow}>+</button>
                  </div>
                ) : (
                  <button className="btn btn-duu btn-sm flex-fill" onClick={handleAdd} disabled={!canAddNow} type="button">
                    + Panier
                  </button>
                )}
              </div>

              {hasVariants && qtyTotal > 0 && (
                <div className="small text-muted mt-2" style={{ lineHeight: 1.1 }}>
                  Total dans le panier (toutes variantes) : <strong>{qtyTotal}</strong>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== MODAL ===== */}
      {open && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.35)" }} onClick={(e) => e.target === e.currentTarget && closeModal()} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{String(anyP.name || "")}</h5>
                <button className="btn-close" onClick={closeModal} type="button" aria-label="Fermer" />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="position-relative rounded overflow-hidden bg-light">
                      {currentImg ? (
                        <img src={currentImg} alt={String(anyP.name || "")} className="w-100" style={{ aspectRatio: "1/1", objectFit: "cover" }} />
                      ) : (
                        <div className="w-100" style={{ aspectRatio: "1/1" }} />
                      )}

                      {images.length > 1 && (
                        <>
                          <button type="button" className="btn btn-sm btn-light position-absolute top-50 start-0 translate-middle-y ms-2" onClick={prevImg} aria-label="Image précédente" style={{ boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
                            ◀
                          </button>
                          <button type="button" className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y me-2" onClick={nextImg} aria-label="Image suivante" style={{ boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
                            ▶
                          </button>

                          <span className="badge position-absolute bottom-0 end-0 m-2 text-white" style={{ background: "rgba(17,17,17,.75)" }}>
                            {imgIdx + 1}/{images.length}
                          </span>
                        </>
                      )}
                    </div>

                    {images.length > 1 && (
                      <div className="d-flex gap-2 mt-2 flex-wrap">
                        {images.slice(0, 12).map((u, i) => {
                          const activeThumb = i === imgIdx;
                          return (
                            <button
                              key={u + i}
                              type="button"
                              onClick={() => setImgIdx(i)}
                              className={"p-0 border rounded overflow-hidden " + (activeThumb ? "border-dark" : "border-0")}
                              style={{ width: 54, height: 54, background: "#fff" }}
                            >
                              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: activeThumb ? 1 : 0.9 }} loading="lazy" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-baseline gap-2">
                      <div className="h5 m-0">Prix:{moneyMAD(displayPrice)}</div>
                      {oldPrice != null && Number(oldPrice) > Number(displayPrice) && (
                        <div className="h6 m-0" style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)" }}>
                          {moneyMAD(oldPrice)}
                        </div>
                      )}
                    </div>

                    {stockText ? (
                      <div className="mt-2">
                        <span className={"badge " + (effectiveStock != null && effectiveStock <= 0 ? "bg-danger" : "bg-light text-dark")} style={{ border: "1px solid rgba(0,0,0,.10)", fontWeight: 900 }}>
                          {stockText}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-2">
                      <ProductRating productId={Number(anyP.id)} />
                    </div>

                    <VariantSelector size="md" />

                    <p className="text-muted mt-3 mb-3">{anyP.description ? shortText(anyP.description, 520) : "Aucune description."}</p>

                    <div className="d-grid gap-2 position-relative">
                      <button className="btn btn-duu fw-semibold" onClick={handleAdd} disabled={!canAddNow} type="button">
                        + Ajouter au panier
                      </button>

                      <button className="btn btn-outline-secondary" onClick={shareProduct} type="button">
                        Partager
                      </button>

                      {/* Fallback menu (desktop) */}
                      {shareMenuOpen && (
                        <div className="duu-share-pop" role="menu">
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.facebook)} type="button">
                            Facebook / Meta
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.whatsapp)} type="button">
                            WhatsApp
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.telegram)} type="button">
                            Telegram
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.x)} type="button">
                            X (Twitter)
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.linkedin)} type="button">
                            LinkedIn
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.pinterest)} type="button">
                            Pinterest
                          </button>
                          <button className="duu-share-item" onClick={() => openShareLink(shareLinks.email)} type="button">
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
                          <button className="duu-share-item" onClick={() => setShareMenuOpen(false)} type="button">
                            Fermer
                          </button>
                        </div>
                      )}
                    </div>

                    {effectiveStock != null && effectiveStock <= 0 && (
                      <div className="alert alert-warning mt-3 py-2 small mb-0">Produit en rupture de stock.</div>
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

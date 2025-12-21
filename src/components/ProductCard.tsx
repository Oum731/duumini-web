// src/components/ProductCard.tsx
import { useMemo, useState, useCallback } from "react";
import type { Product } from "../services/products";
import { API_BASE } from "../services/http";
import { useCart } from "../store/cart";
import ProductRating from "./ProductRating";
import { useLocationCity, type CityCode } from "../context/LocationContext";
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
  return `${v.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} MAD`;
}

function shortText(s?: string | null, max = 200) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function normToken(x: any) {
  return String(x ?? "")
    .trim()
    .toLowerCase();
}

/**
 * ⚠️ IMPORTANT: on n'utilise PAS p.sub_category (n'existe plus sur Product)
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
function buildProductUrl(p: Product) {
  const shareBase =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHARE_BASE_URL) ||
    "https://duumini.com";
  return `${shareBase}/share/product/${Number((p as any).id)}`;
}

/* ===== Filtrage ville ===== */
function normalizeCityLabel(raw: string | null | undefined) {
  if (!raw) return "";
  return String(raw)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeCitiesAny(input: any): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map((x) => String(x || "").trim()).filter(Boolean);

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x || "").trim()).filter(Boolean);
        }
      } catch {}
    }
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
    return [s];
  }

  return [];
}

function isProductAllowedForCity(product: Product, city: CityCode | null) {
  if (!city) return true;
  const anyP = product as any;

  const cities = normalizeCitiesAny(anyP.cities);
  if (!cities.length) return true;

  const userCityNorm = normalizeCityLabel(city);
  return cities.some((c: any) => normalizeCityLabel(c) === userCityNorm);
}

/* ===== Helpers panier ===== */
function findCartLineForProduct(lines: any[], product: Product) {
  const pid = Number((product as any).id);
  return lines.find((l) => {
    const a = Number(l.id ?? 0);
    const b = Number(l.product?.id ?? 0);
    const c = Number(l.product_id ?? l.productId ?? 0);
    return a === pid || b === pid || c === pid;
  });
}

function getQtyInCart(lines: any[], product: Product): number {
  const line = findCartLineForProduct(lines, product);
  if (!line) return 0;
  return Number(line.qty ?? line.quantity ?? 0);
}

/* ===== Component ===== */
type Props = {
  product: Product;
  onAdd?: (p: Product) => void;

  priceOverride?: number | null;
  oldPrice?: number | null;
  badgeText?: string | null;

  /** Peut contenir des slugs/noms OU des ids (ex: ["boissons"] ou ["3"]) */
  hideSubCategories?: string[];
};

export default function ProductCard({
  product,
  onAdd,
  priceOverride = null,
  oldPrice = null,
  badgeText = null,
  hideSubCategories = [],
}: Props) {
  const { city } = useLocationCity();
  const { add, lines } = useCart();
  const anyP = product as any;

  const subCatToken = useMemo(() => getSubCategoryToken(product), [product]);

  const hideList = useMemo(
    () => hideSubCategories.map((x) => normToken(x)).filter(Boolean),
    [hideSubCategories]
  );

  if (subCatToken && hideList.includes(subCatToken)) return null;

  const isActive = Number(anyP.is_active ?? anyP.active ?? 1) === 1;
  const stock = anyP.stock;
  const isOutOfStock = stock === 0;

  const isCityAllowed = useMemo(() => isProductAllowedForCity(product, city), [product, city]);
  if (!isActive || !isCityAllowed) return null;

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

  const qtyInCart = useMemo(() => getQtyInCart(lines as any[], product), [lines, product]);

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  const shareUrl = useMemo(() => buildProductUrl(product), [product]);

  const displayPrice = Number(priceOverride ?? anyP.price_client ?? anyP.price ?? 0);
  const shareText = `${String(anyP.name || "Produit")} — ${moneyMAD(displayPrice)} sur Duumini`;

  const handleAdd = useCallback(() => {
    if (isOutOfStock) return;

    const productForCart: any = {
      ...anyP,
      price: displayPrice,
      _pricing: {
        basePrice: Number(anyP.price ?? 0),
        finalPrice: displayPrice,
        isPromo: priceOverride != null && oldPrice != null,
        badge: badgeText ?? null,
      },
    };

    if (onAdd) onAdd(productForCart);
    else add(productForCart, 1);

    trackAddToCart({
      productId: anyP.id,
      name: anyP.name,
      price: displayPrice,
      quantity: 1,
      currency: "MAD",
      category: subCatToken || "",
    });
  }, [
    add,
    anyP,
    badgeText,
    displayPrice,
    isOutOfStock,
    oldPrice,
    onAdd,
    priceOverride,
    subCatToken,
  ]);

  const handleDecrease = useCallback(() => {
    if (!qtyInCart) return;
    add(anyP, -1);
  }, [add, anyP, qtyInCart]);

  const openModal = useCallback(() => {
    setImgIdx(0);
    setOpen(true);
  }, []);

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

  const shareProduct = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: anyP.name,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [anyP.name, shareText, shareUrl]);

  return (
    <>
      <div className="card h-100 border-0 shadow-sm">
        <div className="position-relative">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={String(anyP.name || "")}
              className="w-100"
              style={{ aspectRatio: "1/1", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <div className="w-100 bg-light" style={{ aspectRatio: "1/1" }} />
          )}

          {isOutOfStock && (
            <span className="badge bg-danger position-absolute top-0 start-0 m-2">
              En rupture
            </span>
          )}

          {!!badgeText && !isOutOfStock && (
            <span
              className="badge position-absolute top-0 end-0 m-2 text-white"
              style={{ background: "var(--duu-red)" }}
            >
              {badgeText}
            </span>
          )}
        </div>

        <div className="card-body d-flex flex-column">
          <h3 className="h6 mb-1">
            <button
              className="btn btn-link p-0 text-start text-dark"
              onClick={openModal}
              style={{ textDecoration: "none" }}
              type="button"
            >
              {String(anyP.name || "")}
            </button>
          </h3>

          <div className="mb-1">
            <ProductRating productId={Number(anyP.id)} />
          </div>

          <div className="d-flex align-items-baseline gap-2 mb-2">
            <div className="fw-semibold">{moneyMAD(displayPrice)}</div>
            {oldPrice != null && oldPrice > displayPrice && (
              <div
                style={{
                  textDecoration: "line-through",
                  color: "rgba(0,0,0,.45)",
                  fontWeight: 700,
                }}
              >
                {moneyMAD(oldPrice)}
              </div>
            )}
          </div>

          <div className="mt-auto d-flex gap-2">
            <button className="btn btn-outline-dark btn-sm flex-fill" onClick={openModal} type="button">
              Voir
            </button>

            {qtyInCart > 0 ? (
              <div className="btn-group btn-group-sm flex-fill" role="group" aria-label="Quantité panier">
                <button className="btn btn-outline-dark" onClick={handleDecrease} type="button">
                  −
                </button>
                <button className="btn btn-light disabled" type="button">
                  {qtyInCart}
                </button>
                <button className="btn btn-duu" onClick={handleAdd} type="button">
                  +
                </button>
              </div>
            ) : (
              <button
                className="btn btn-duu btn-sm flex-fill"
                onClick={handleAdd}
                disabled={isOutOfStock}
                type="button"
              >
                + Panier
              </button>
            )}
          </div>
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
                        <img
                          src={currentImg}
                          alt={String(anyP.name || "")}
                          className="w-100"
                          style={{ aspectRatio: "1/1", objectFit: "cover" }}
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
                            title="Précédent"
                            style={{ boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y me-2"
                            onClick={nextImg}
                            aria-label="Image suivante"
                            title="Suivant"
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

                    {images.length > 1 && (
                      <div className="d-flex gap-2 mt-2 flex-wrap">
                        {images.slice(0, 8).map((u, i) => {
                          const active = i === imgIdx;
                          return (
                            <button
                              key={u + i}
                              type="button"
                              onClick={() => setImgIdx(i)}
                              className={
                                "p-0 border rounded overflow-hidden " + (active ? "border-dark" : "border-0")
                              }
                              style={{ width: 54, height: 54, background: "#fff" }}
                              aria-label={`Voir image ${i + 1}`}
                              title={`Image ${i + 1}`}
                            >
                              <img
                                src={u}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  opacity: active ? 1 : 0.9,
                                }}
                                loading="lazy"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-baseline gap-2">
                      <div className="h5 m-0">{moneyMAD(displayPrice)}</div>
                      {oldPrice != null && oldPrice > displayPrice && (
                        <div
                          className="h6 m-0"
                          style={{
                            textDecoration: "line-through",
                            color: "rgba(0,0,0,.45)",
                          }}
                        >
                          {moneyMAD(oldPrice)}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <ProductRating productId={Number(anyP.id)} />
                    </div>

                    <p className="text-muted mt-2 mb-3">
                      {anyP.description ? shortText(anyP.description, 520) : "Aucune description."}
                    </p>

                    <div className="d-grid gap-2">
                      <button className="btn btn-duu fw-semibold" onClick={handleAdd} disabled={isOutOfStock} type="button">
                        + Ajouter au panier
                      </button>

                      <button className="btn btn-outline-secondary" onClick={shareProduct} type="button">
                        {copied ? "Lien copié" : "Partager"}
                      </button>
                    </div>

                    {isOutOfStock && (
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

          <style>{`
            .btn-duu{
              background: var(--duu-yellow);
              color: #1f1f1f;
              border: none;
            }
            .btn-duu:hover{ filter: brightness(0.95); }
          `}</style>
        </div>
      )}
    </>
  );
}

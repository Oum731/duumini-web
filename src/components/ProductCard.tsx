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
  return String(x ?? "").trim().toLowerCase();
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
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHARE_BASE_URL) ||
    "https://duumini.com";
  return `${shareBase}/share/product/${Number((p as any).id)}`;
}

/* ===== Filtrage ville (client-side) ===== */
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

/* ===== Image style (best effort “bg remove”) =====
   - Si image sur fond blanc/gris → mix-blend-mode:multiply aide à “fondre” le fond.
   - On privilégie object-fit: contain pour un rendu e-commerce propre.
*/
function looksLikeTransparentFriendly(url: string) {
  const u = (url || "").toLowerCase();
  return u.endsWith(".png") || u.includes(".png?") || u.endsWith(".webp") || u.includes(".webp?");
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

  const hideList = useMemo(() => hideSubCategories.map((x) => normToken(x)).filter(Boolean), [hideSubCategories]);
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
  }, [add, anyP, badgeText, displayPrice, isOutOfStock, oldPrice, onAdd, priceOverride, subCatToken]);

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

  const imgNoBg = useMemo(() => (coverUrl ? looksLikeTransparentFriendly(coverUrl) : false), [coverUrl]);

  return (
    <>
      <div className="duu-card card h-100 border-0">
        <div className="duu-media position-relative">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={String(anyP.name || "")}
              className={"duu-img " + (imgNoBg ? "duu-img-nobg" : "")}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="duu-img-placeholder" />
          )}

          {/* Badges */}
          {isOutOfStock && <span className="duu-badge duu-badge-danger">En rupture</span>}

          {!!badgeText && !isOutOfStock && <span className="duu-badge duu-badge-hot">{badgeText}</span>}

          {/* Quick add */}
          {!isOutOfStock && (
            <button
              type="button"
              className="duu-quick"
              onClick={handleAdd}
              aria-label="Ajouter au panier"
              title="Ajouter au panier"
            >
              + Panier
            </button>
          )}
        </div>

        <div className="card-body d-flex flex-column p-3">
          <button
            className="duu-title btn btn-link p-0 text-start"
            onClick={openModal}
            type="button"
            title={String(anyP.name || "")}
          >
            {String(anyP.name || "")}
          </button>

          <div className="mt-1">
            <ProductRating productId={Number(anyP.id)} />
          </div>

          <div className="d-flex align-items-baseline gap-2 mt-2">
            <div className="duu-price">{moneyMAD(displayPrice)}</div>
            {oldPrice != null && oldPrice > displayPrice && (
              <div className="duu-old">{moneyMAD(oldPrice)}</div>
            )}
          </div>

          <div className="mt-auto pt-2 d-flex gap-2">
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
              <button className="btn btn-duu btn-sm flex-fill" onClick={handleAdd} disabled={isOutOfStock} type="button">
                Ajouter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div
          className="modal d-block"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div className="me-2">
                  <h5 className="modal-title mb-0">{String(anyP.name || "")}</h5>
                  <div className="small text-muted">{subCatToken ? subCatToken : ""}</div>
                </div>
                <button className="btn-close" onClick={closeModal} type="button" aria-label="Fermer" />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="duu-modal-media rounded-4 overflow-hidden">
                      {currentImg ? (
                        <img
                          src={currentImg}
                          alt={String(anyP.name || "")}
                          className={"duu-modal-img " + (looksLikeTransparentFriendly(currentImg) ? "duu-img-nobg" : "")}
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
                            style={{ boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y me-2"
                            onClick={nextImg}
                            aria-label="Image suivante"
                            title="Suivant"
                            style={{ boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}
                          >
                            ▶
                          </button>

                          <span className="badge position-absolute bottom-0 end-0 m-2 text-white" style={{ background: "rgba(17,17,17,.72)" }}>
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
                              className={"duu-thumb " + (active ? "active" : "")}
                              aria-label={`Voir image ${i + 1}`}
                              title={`Image ${i + 1}`}
                            >
                              <img src={u} alt="" loading="lazy" decoding="async" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="d-flex align-items-baseline gap-2">
                      <div className="h4 m-0">{moneyMAD(displayPrice)}</div>
                      {oldPrice != null && oldPrice > displayPrice && (
                        <div className="h6 m-0" style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)" }}>
                          {moneyMAD(oldPrice)}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <ProductRating productId={Number(anyP.id)} />
                    </div>

                    <p className="text-muted mt-3 mb-3">
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

          <style>{`
            .btn-duu{
              background: var(--duu-yellow);
              color: #1f1f1f;
              border: none;
              font-weight: 800;
            }
            .btn-duu:hover{ filter: brightness(.95); }

            /* ===== Card modern ===== */
            .duu-card{
              border-radius: 18px;
              background: rgba(255,255,255,.92);
              box-shadow: 0 10px 26px rgba(0,0,0,.08);
              transition: transform .15s ease, box-shadow .15s ease;
              overflow: hidden;
            }
            .duu-card:hover{
              transform: translateY(-2px);
              box-shadow: 0 14px 34px rgba(0,0,0,.12);
            }

            .duu-media{
              position: relative;
              background: #fff;
            }

            /* Cadre image e-commerce */
            .duu-img,
            .duu-img-placeholder{
              width: 100%;
              aspect-ratio: 1 / 1;
              display: block;
              background: linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.00));
            }

            /* On privilégie contain pour look “produit” */
            .duu-img{
              object-fit: contain;
              padding: 10px;
            }
            .duu-img-placeholder{
              background: rgba(0,0,0,.04);
            }

            /* Best effort “bg remove” (super pour fond blanc) */
            .duu-img-nobg{
              mix-blend-mode: multiply;
              filter: contrast(1.06) saturate(1.03);
            }

            /* Badges */
            .duu-badge{
              position: absolute;
              top: 10px;
              left: 10px;
              font-weight: 900;
              font-size: 12px;
              padding: 6px 10px;
              border-radius: 999px;
              backdrop-filter: blur(6px);
              box-shadow: 0 10px 22px rgba(0,0,0,.12);
            }
            .duu-badge-danger{
              background: rgba(229,57,53,.95);
              color: #fff;
            }
            .duu-badge-hot{
              left: auto;
              right: 10px;
              background: rgba(17,17,17,.82);
              color: #fff;
            }

            /* Quick add (survol desktop) */
            .duu-quick{
              position: absolute;
              bottom: 10px;
              right: 10px;
              border: none;
              border-radius: 999px;
              padding: 8px 12px;
              font-weight: 900;
              background: rgba(255,213,79,.96);
              color: #111;
              box-shadow: 0 12px 24px rgba(0,0,0,.14);
              opacity: 0;
              transform: translateY(6px);
              transition: opacity .15s ease, transform .15s ease, filter .15s ease;
            }
            .duu-quick:hover{ filter: brightness(.95); }

            @media (hover: hover){
              .duu-card:hover .duu-quick{
                opacity: 1;
                transform: translateY(0);
              }
            }
            @media (hover: none){
              .duu-quick{ opacity: 1; transform: translateY(0); }
            }

            /* Title clamp */
            .duu-title{
              color: #111 !important;
              font-weight: 900;
              text-decoration: none !important;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              line-height: 1.15;
              font-size: 14px;
            }

            .duu-price{
              font-weight: 950;
              letter-spacing: -.2px;
              font-size: 16px;
              color: #111;
            }
            .duu-old{
              font-weight: 800;
              font-size: 13px;
              color: rgba(0,0,0,.45);
              text-decoration: line-through;
            }

            /* Modal media */
            .duu-modal-media{
              position: relative;
              background: #fff;
              border: 1px solid rgba(0,0,0,.06);
            }
            .duu-modal-img{
              width: 100%;
              aspect-ratio: 1/1;
              object-fit: contain;
              padding: 14px;
              display: block;
              background: linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.00));
            }

            .duu-thumb{
              width: 54px;
              height: 54px;
              border-radius: 12px;
              overflow: hidden;
              border: 1px solid rgba(0,0,0,.12);
              background: #fff;
              padding: 0;
            }
            .duu-thumb img{
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              opacity: .92;
            }
            .duu-thumb.active{
              border-color: rgba(0,0,0,.55);
            }
            .duu-thumb.active img{
              opacity: 1;
            }
          `}</style>
        </div>
      )}
    </>
  );
}

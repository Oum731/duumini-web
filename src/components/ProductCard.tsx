import { useMemo, useState } from "react";
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

/* ===== Partage ===== */
function buildProductUrl(p: Product) {
  const shareBase =
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHARE_BASE_URL) ||
    "https://duumini-api.onrender.com";

  return `${shareBase}/share/product/${p.id}`;
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

function isProductAllowedForCity(product: Product, city: CityCode | null) {
  if (!city) return true;
  const anyP = product as any;
  const cities = Array.isArray(anyP.cities) ? anyP.cities : null;
  if (!cities || cities.length === 0) return true;

  const userCityNorm = normalizeCityLabel(city);
  return cities.some((c: any) => normalizeCityLabel(c) === userCityNorm);
}

/* ===== Helpers panier ===== */
function findCartLineForProduct(lines: any[], product: Product) {
  const pid = Number(product.id);
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

  /** ✅ Permet d’afficher un prix promo et de l’utiliser au panier */
  priceOverride?: number | null;

  /** ✅ Affichage “ancien prix barré” */
  oldPrice?: number | null;

  /** ✅ Badge promo (ex: "-20%") */
  badgeText?: string | null;
};

export default function ProductCard({
  product,
  onAdd,
  priceOverride = null,
  oldPrice = null,
  badgeText = null,
}: Props) {
  const { city } = useLocationCity();
  const { add, lines } = useCart();

  /* ❌ NE PAS AFFICHER LES PRODUITS FOOD */
  const isFood =
    String((product as any).sub_category || "").trim().toLowerCase() === "food";
  if (isFood) return null;

  const isActive =
    ((product as any).is_active ?? (product as any).active ?? 1) === 1;
  const stock = (product as any).stock;
  const isOutOfStock = stock === 0;

  const isCityAllowed = useMemo(
    () => isProductAllowedForCity(product, city),
    [product, city]
  );
  if (!isActive || !isCityAllowed) return null;

  const cover = (product as any).cover || (product as any).images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);

  const qtyInCart = useMemo(
    () => getQtyInCart(lines as any[], product),
    [lines, product]
  );

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => buildProductUrl(product), [product]);

  // ✅ Prix utilisé partout (affichage + analytics + panier)
  const displayPrice = Number(
    priceOverride ?? (product as any).price ?? (product as any).price_client ?? 0
  );

  const shareText = `${(product as any).name} — ${moneyMAD(displayPrice)} sur Duumini`;

  const handleAdd = () => {
    if (isOutOfStock) return;

    // ✅ Injecter le prix dans l’objet ajouté au panier (sans modifier l’objet original)
    const productForCart: any = {
      ...(product as any),
      price: displayPrice,
      _pricing: {
        basePrice: Number((product as any).price ?? 0),
        finalPrice: displayPrice,
        isPromo: priceOverride != null && oldPrice != null,
        badge: badgeText ?? null,
      },
    };

    if (onAdd) onAdd(productForCart);
    else add(productForCart, 1);

    trackAddToCart({
      productId: (product as any).id,
      name: (product as any).name,
      price: displayPrice,
      quantity: 1,
      currency: "MAD",
      category: (product as any).sub_category || "",
    });
  };

  const handleDecrease = () => {
    if (!qtyInCart) return;
    add(product as any, -1);
  };

  async function shareProduct() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: (product as any).name,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <>
      <div className="card h-100 border-0 shadow-sm">
        <div className="position-relative">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={(product as any).name}
              className="w-100"
              style={{ aspectRatio: "1/1", objectFit: "cover" }}
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
            <span className="badge position-absolute top-0 end-0 m-2 text-white" style={{ background: "var(--duu-red)" }}>
              {badgeText}
            </span>
          )}
        </div>

        <div className="card-body d-flex flex-column">
          <h3 className="h6 mb-1">
            <button
              className="btn btn-link p-0 text-start text-dark"
              onClick={() => setOpen(true)}
            >
              {(product as any).name}
            </button>
          </h3>

          <div className="mb-1">
            <ProductRating productId={(product as any).id} />
          </div>

          <div className="d-flex align-items-baseline gap-2 mb-2">
            <div className="fw-semibold">{moneyMAD(displayPrice)}</div>
            {oldPrice != null && oldPrice > displayPrice && (
              <div style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)", fontWeight: 700 }}>
                {moneyMAD(oldPrice)}
              </div>
            )}
          </div>

          <div className="mt-auto d-flex gap-2">
            <button
              className="btn btn-outline-dark btn-sm flex-fill"
              onClick={() => setOpen(true)}
            >
              Voir
            </button>

            {qtyInCart > 0 ? (
              <div className="btn-group btn-group-sm flex-fill">
                <button className="btn btn-outline-dark" onClick={handleDecrease}>
                  −
                </button>
                <button className="btn btn-light disabled">{qtyInCart}</button>
                <button className="btn btn-dark" onClick={handleAdd}>
                  +
                </button>
              </div>
            ) : (
              <button
                className="btn btn-dark btn-sm flex-fill"
                onClick={handleAdd}
                disabled={isOutOfStock}
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
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{(product as any).name}</h5>
                <button className="btn-close" onClick={() => setOpen(false)} />
              </div>

              <div className="modal-body">
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={(product as any).name}
                    className="img-fluid rounded mb-3"
                  />
                )}

                <div className="d-flex align-items-baseline gap-2">
                  <div className="h5 m-0">{moneyMAD(displayPrice)}</div>
                  {oldPrice != null && oldPrice > displayPrice && (
                    <div className="h6 m-0" style={{ textDecoration: "line-through", color: "rgba(0,0,0,.45)" }}>
                      {moneyMAD(oldPrice)}
                    </div>
                  )}
                </div>

                <ProductRating productId={(product as any).id} />

                <p className="text-muted mt-2">
                  {(product as any).description
                    ? shortText((product as any).description, 320)
                    : "Aucune description."}
                </p>

                <div className="d-grid gap-2">
                  <button className="btn btn-dark" onClick={handleAdd}>
                    + Ajouter au panier
                  </button>
                  <button className="btn btn-outline-secondary" onClick={shareProduct}>
                    {copied ? "Lien copié" : "Partager"}
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={() => setOpen(false)}>
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

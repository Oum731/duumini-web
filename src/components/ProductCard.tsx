// src/components/ProductCard.tsx
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

/**
 * URL de partage → route /share/product/:id
 */
function buildProductUrl(p: Product) {
  const shareBase =
    // @ts-ignore
    (typeof import.meta !== "undefined" &&
      (import.meta as any).env?.VITE_SHARE_BASE_URL) ||
    "https://duumini-api.onrender.com";

  return `${shareBase}/share/product/${p.id}`;
}

/* ===== Filtrage par ville de la BOUTIQUE ===== */

function normalizeCityLabel(raw: string | null | undefined) {
  if (!raw) return "";
  return String(raw)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Le tri se fait en fonction de la ville de la boutique du produit.
 */
function isProductAllowedForCity(product: Product, city: CityCode | null) {
  if (!city) {
    return true;
  }

  const userCityNorm = normalizeCityLabel(city);
  const anyP = product as any;

  const rawShopCityCode = anyP.shop_city_code ?? null;
  const rawShopCity = anyP.shop_city ?? null;

  if (rawShopCityCode) {
    const normCode = normalizeCityLabel(String(rawShopCityCode));
    return normCode === userCityNorm;
  }

  if (rawShopCity) {
    const normCity = normalizeCityLabel(String(rawShopCity));
    return normCity === userCityNorm;
  }

  return true;
}

/* ===== Helpers panier robustes ===== */

/** Récupère la ligne du panier correspondant à ce produit */
function findCartLineForProduct(lines: any[], product: Product) {
  const pid = Number((product as any).id);
  if (!pid) return null;

  return (lines as any[]).find((l) => {
    // id principal de la ligne (CartLine.id)
    const fromId = l.id != null ? Number(l.id) : null;

    // id dans l'objet product stocké dans la ligne
    const fromProductObj =
      l.product && l.product.id != null ? Number(l.product.id) : null;

    // compat : champs product_id / productId / product_id_pk
    const compatRaw =
      l.product_id ?? l.productId ?? l.product_id_pk ?? null;
    const fromCompat =
      compatRaw != null ? Number(compatRaw) : null;

    return fromId === pid || fromProductObj === pid || fromCompat === pid;
  });
}

/** Récupère la quantité dans le panier pour ce produit */
function getQtyInCart(lines: any[], product: Product): number {
  const line = findCartLineForProduct(lines, product);
  if (!line) return 0;

  const q =
    line.qty ??
    line.quantity ??
    line.count ??
    line.q ??
    0;

  return Number(q || 0);
}

/** Extrait sub_category d'une ligne (line ou line.product) */
function getSubCategoryFromLine(line: any): string {
  return String(
    line.sub_category ??
      line.product?.sub_category ??
      line.product?.category ??
      ""
  )
    .trim()
    .toLowerCase();
}

/** Extrait shop_id d'une ligne (line ou line.product/shop) */
function getShopIdFromLine(line: any): number | null {
  const raw =
    line.shop_id ??
    line.product?.shop_id ??
    line.product?.shop?.id ??
    null;

  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Cherche un shop_id de resto (sub_category = food) dans le panier */
function getCurrentFoodShopId(lines: any[]): number | null {
  if (!Array.isArray(lines) || !lines.length) return null;

  for (const l of lines as any[]) {
    const sub = getSubCategoryFromLine(l);
    if (sub === "food") {
      const sid = getShopIdFromLine(l);
      if (sid != null) return sid;
    }
  }
  return null;
}

/* ===== Component ===== */
type Props = { product: Product; onAdd?: (p: Product) => void };

export default function ProductCard({ product, onAdd }: Props) {
  const { city } = useLocationCity();

  const stock = (product as any).stock;
  const isOutOfStock = stock === 0;
  const isActive =
    ((product as any).is_active ?? (product as any).active ?? 1) ? true : false;
  const isAvailable = isActive && !isOutOfStock;

  const isCityAllowed = useMemo(
    () => isProductAllowedForCity(product, city),
    [product, city]
  );

  if (!isActive || !isCityAllowed) {
    return null;
  }

  const cover = product.cover || product.images?.[0]?.url || null;
  const coverUrl = imgUrl(cover);

  const shopImage = imgUrl(product.shop_logo || product.shop_cover || null);
  const hasShopImage = !!(product.shop_logo || product.shop_cover);

  const tag =
    product.sub_category === "food"
      ? {
          cls: "bg-success-subtle text-success-emphasis border-success-subtle",
        }
      : {
          cls: "bg-primary-subtle text-primary-emphasis border-primary-subtle",
        };

  const { add, lines } = useCart();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // ✅ Shop Food courant dans le panier (si déjà des plats food)
  const currentFoodShopId: number | null = useMemo(
    () => getCurrentFoodShopId(lines as any[]),
    [lines]
  );

  // ✅ Quantité de CE produit dans le panier
  const qtyInCart: number = useMemo(
    () => getQtyInCart(lines as any[], product),
    [lines, product]
  );

  const shareUrl = useMemo(() => buildProductUrl(product), [product]);
  const shareText = useMemo(
    () => `${product.name} — ${moneyMAD(product.price)} sur Duumini`,
    [product.name, product.price]
  );

  // 🔒 Ajout avec règle Food (un resto à la fois)
  const handleAdd = () => {
    if (!isAvailable) return;

    setWarning(null);

    const isFood = String(product.sub_category || "")
      .trim()
      .toLowerCase() === "food";
    const productShopId =
      (product as any).shop_id != null ? Number((product as any).shop_id) : null;

    if (
      isFood &&
      currentFoodShopId != null &&
      productShopId != null &&
      currentFoodShopId !== productShopId
    ) {
      setWarning(
        "Votre panier contient déjà des plats d’un autre restaurant. Videz votre panier pour changer de restaurant."
      );
      return;
    }

    // Ajout (ou +1) dans le panier
    if (onAdd) {
      onAdd(product);
    } else {
      add(product as any, 1);
    }

    const anyP = product as any;
    const priceClient =
      typeof anyP.price_client === "number" ? anyP.price_client : product.price;
    const category =
      anyP.category_name || anyP.sub_category || product.sub_category || "";

    trackAddToCart({
      productId: product.id,
      name: product.name,
      price: priceClient || 0,
      quantity: 1,
      currency: "MAD",
      category,
    });
  };

  // ➖ Décrémenter la quantité (pas de règle nécessaire ici)
  const handleDecrease = () => {
    if (!isAvailable) return;
    if (!qtyInCart) return;
    setWarning(null);

    try {
      // ⚠️ nécessite bien la version de add(p, qty) qui gère les négatifs
      add(product as any, -1);
    } catch {
      // on ignore silencieusement si jamais l’implémentation diffère
    }
  };

  // ➕ Incrémenter (réutilise la logique d’ajout avec règle Food)
  const handleIncrease = () => {
    handleAdd();
  };

  async function shareProduct() {
    const navAny: any =
      typeof navigator !== "undefined" ? (navigator as any) : null;

    try {
      if (navAny && typeof navAny.share === "function") {
        await navAny.share({
          title: product.name,
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
              alt={product.name}
              className="w-100"
              style={{
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderTopLeftRadius: ".5rem",
                borderTopRightRadius: ".5rem",
              }}
              loading="lazy"
            />
          ) : (
            <div
              className="w-100 bg-light"
              style={{
                aspectRatio: "1 / 1",
                borderTopLeftRadius: ".5rem",
                borderTopRightRadius: ".5rem",
              }}
            />
          )}

          {isOutOfStock && (
            <span
              className="badge bg-danger position-absolute top-0 start-0 m-2"
              style={{ backdropFilter: "blur(4px)" }}
            >
              En rupture
            </span>
          )}

          <span
            className={`badge position-absolute top-0 end-0 m-2 border ${tag.cls}`}
            style={{ backdropFilter: "blur(4px)" }}
          ></span>

          {hasShopImage && (
            <div className="position-absolute" style={{ bottom: 8, left: 8 }}>
              <img
                src={shopImage}
                alt={product.shop_name || "Boutique"}
                className="rounded-circle border border-white"
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "cover",
                  boxShadow: "0 0 0 2px rgba(0,0,0,.1)",
                }}
              />
            </div>
          )}
        </div>

        <div className="card-body d-flex flex-column">
          <h3
            className="h6 mb-1"
            title={product.name}
            style={{ wordWrap: "break-word", whiteSpace: "normal" }}
          >
            <button
              type="button"
              className="btn btn-link p-0 text-start text-decoration-none text-dark"
              onClick={() => setOpen(true)}
              style={{ whiteSpace: "normal" }}
            >
              {product.name}
            </button>
          </h3>

          {product.shop_name && (
            <div className="small text-muted mb-1">{product.shop_name}</div>
          )}

          <div className="fw-semibold mb-1">
            {moneyMAD(product.price)}
          </div>

          {/* ⚠️ Message clair en cas de conflit Food multi-resto */}
          {warning && (
            <div className="small text-danger mb-2">
              {warning}
            </div>
          )}

          <div className="mb-2">
            <ProductRating productId={product.id} />
          </div>

          <div className="mt-auto d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-dark btn-sm flex-fill"
              onClick={() => setOpen(true)}
            >
              Voir
            </button>

            {/* ✅ Bouton Panier → bascule en - / + si qtyInCart > 0 */}
            {!isAvailable ? (
              <button
                className="btn btn-dark btn-sm flex-fill"
                disabled
                title="En rupture de stock"
              >
                En rupture
              </button>
            ) : qtyInCart > 0 ? (
              <div
                className="btn-group btn-group-sm flex-fill"
                role="group"
                aria-label="Quantité dans le panier"
              >
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={handleDecrease}
                >
                  −
                </button>
                <button
                  type="button"
                  className="btn btn-light disabled"
                  style={{ minWidth: 40 }}
                >
                  {qtyInCart}
                </button>
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={handleIncrease}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                className="btn btn-dark btn-sm flex-fill"
                onClick={handleAdd}
                title="Ajouter au panier"
              >
                + Panier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modal détail produit ===== */}
      {open && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ background: "rgba(0,0,0,.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg modal-fullscreen-sm-down"
            role="document"
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {product.name}
                  {product.shop_name && (
                    <span className="ms-2 small text-muted">
                      — {product.shop_name}
                    </span>
                  )}
                </h5>
                <button
                  className="btn-close"
                  aria-label="Fermer"
                  onClick={() => setOpen(false)}
                />
              </div>

              <div className="modal-body">
                <div className="row g-3 align-items-start">
                  <div className="col-12 col-md-6 position-relative">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={product.name}
                        className="img-fluid rounded"
                        style={{ width: "100%", height: "auto" }}
                      />
                    ) : (
                      <div
                        className="bg-light rounded"
                        style={{ width: "100%", paddingTop: "100%" }}
                      />
                    )}

                    {hasShopImage && (
                      <div
                        className="position-absolute"
                        style={{ bottom: 12, left: 12 }}
                      >
                        <img
                          src={shopImage}
                          alt={product.shop_name || "Boutique"}
                          className="rounded-circle border border-white"
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: "cover",
                            boxShadow: "0 0 0 2px rgba(0,0,0,.1)",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6 d-flex flex-column">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="h5 m-0">
                        {moneyMAD(product.price)}
                      </span>
                      <span className={`badge border ${tag.cls}`}></span>
                      {isOutOfStock && (
                        <span className="badge bg-danger">En rupture</span>
                      )}
                    </div>

                    <div className="mb-2">
                      <ProductRating productId={product.id} />
                    </div>

                    {product.description ? (
                      <p className="text-muted">
                        {shortText(product.description, 320)}
                      </p>
                    ) : (
                      <p className="text-muted">Aucune description fournie.</p>
                    )}

                    {/* Message d’avertissement dans le modal aussi */}
                    {warning && (
                      <div className="small text-danger mb-2">
                        {warning}
                      </div>
                    )}

                    <div className="mt-auto d-grid gap-2">
                      {!isAvailable ? (
                        <button className="btn btn-dark" disabled>
                          En rupture
                        </button>
                      ) : qtyInCart > 0 ? (
                        <div
                          className="btn-group"
                          role="group"
                          aria-label="Quantité dans le panier"
                        >
                          <button
                            type="button"
                            className="btn btn-outline-dark"
                            onClick={handleDecrease}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="btn btn-light disabled"
                            style={{ minWidth: 48 }}
                          >
                            {qtyInCart}
                          </button>
                          <button
                            type="button"
                            className="btn btn-dark"
                            onClick={handleIncrease}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-dark"
                          onClick={handleAdd}
                        >
                          + Ajouter au panier
                        </button>
                      )}

                      <button
                        className="btn btn-outline-secondary"
                        onClick={shareProduct}
                      >
                        {copied ? "Lien copié" : "Partager"}
                      </button>
                    </div>
                  </div>
                </div>

                {Array.isArray(product.images) && product.images.length > 1 && (
                  <div className="mt-3">
                    <div className="d-flex gap-2 flex-wrap">
                      {product.images.slice(0, 6).map((im, i) => (
                        <img
                          key={i}
                          src={imgUrl(im.url)}
                          alt={`${product.name} ${i + 1}`}
                          className="rounded"
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-dark ms-auto"
                  onClick={() => setOpen(false)}
                >
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

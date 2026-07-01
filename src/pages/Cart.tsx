import { useMemo, useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../store/cart";
import { listProducts, type Product } from "../services/products";
import { moneyMAD as mad } from "../utils/money";
import { imgUrl } from "../utils/media";

const DRINK_WORDS = [
  "boisson",
  "boissons",
  "jus",
  "soda",
  "eau",
  "eaux",
  "bissap",
  "gingembre",
  "cocktail",
  "yaourt",
  "café",
  "cafe",
  "thé",
  "the",
  "fanta",
  "coca",
  "sprite",
  "canette",
  "ice tea",
  "eau minérale",
  "eau minerale",
  "energy drink",
];

const FOOD_WORDS = [
  "food",
  "plat",
  "plats",
  "repas",
  "grillade",
  "grillades",
  "riz",
  "attiéké",
  "attieke",
  "poisson",
  "poulet",
  "sauce",
  "braisé",
  "braise",
  "kedjenou",
  "tchep",
  "thieb",
  "alloco",
  "foutou",
  "garba",
  "viande",
];

function normalizeText(v: any) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function hasAnyWord(text: string, words: string[]) {
  const t = normalizeText(text);
  return words.some((w) => t.includes(normalizeText(w)));
}

function getJoinedFields(obj: any) {
  return [
    obj?.name,
    obj?.title,
    obj?.label,
    obj?.channel,
    obj?.vertical,
    obj?.type,
    obj?.kind,
    obj?.category_name,
    obj?.subcategory_name,
    obj?.sub_category_name,
    obj?.category?.name,
    obj?.subCategory?.name,
    obj?.sub_category?.name,
    obj?.description,
    obj?.short_description,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isDrinkCategoryLike(p: any) {
  const categoryText = [
    p?.category_name,
    p?.subcategory_name,
    p?.sub_category_name,
    p?.category?.name,
    p?.subCategory?.name,
    p?.sub_category?.name,
  ]
    .filter(Boolean)
    .join(" | ");

  return hasAnyWord(categoryText, DRINK_WORDS);
}


function isFoodProductLike(p: any) {
  const joined = getJoinedFields(p);
  if (normalizeText(p?.vertical) === "food") return true;
  if (normalizeText(p?.channel) === "african-food") return true;
  return hasAnyWord(joined, FOOD_WORDS);
}

function firstCoverOf(product: any) {
  if (product?.cover) return product.cover;
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images[0]?.url || product.images[0]?.image || product.images[0] || "";
  }
  return "";
}

function getUnitPrice(product: any) {
  const promo =
    Number(
      product?.promo_price_client ??
        product?.promo_price ??
        product?.price_promo ??
        product?.sale_price ??
        0
    ) || 0;

  const base =
    Number(product?.price_client ?? product?.price ?? product?.base_price ?? 0) || 0;

  if (promo > 0 && base > 0 && promo < base) return promo;
  if (promo > 0 && base <= 0) return promo;
  return base;
}

function getLineId(l: any) {
  return String(
    l?.line_id || `${Number(l?.id || 0)}:${String(l?.variant?.variant_key || "default")}`
  );
}

function buildCartSignature(lines: any[]) {
  return lines
    .map((l) => `${Number(l?.id || 0)}:${Number(l?.qty || 0)}`)
    .sort()
    .join("|");
}

function FocusAndLoadingStyle() {
  return (
    <style>{`
      .cart-page .btn:focus,
      .cart-page .btn:focus-visible,
      .cart-page .form-control:focus,
      .cart-page .form-select:focus {
        outline: none !important;
        box-shadow: 0 0 0 .25rem rgba(229, 57, 53, .35) !important;
        border-color: #E53935 !important;
      }

      .cart-page .btn[aria-busy="true"],
      .cart-page .form-control[aria-busy="true"] {
        pointer-events: none;
        opacity: .9;
      }

      .cart-page .visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .drink-upsell-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, .52);
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }

      .drink-upsell-modal{
        width: min(980px, 100%);
        max-height: 90vh;
        overflow: hidden;
        border-radius: 24px;
        background:
          radial-gradient(700px 260px at 0% 0%, rgba(255, 193, 7, .18), transparent 60%),
          radial-gradient(650px 220px at 100% 0%, rgba(229, 57, 53, .10), transparent 55%),
          #fff;
        border: 1px solid rgba(0,0,0,.08);
        box-shadow: 0 22px 70px rgba(0,0,0,.22);
      }

      .drink-upsell-head{
        padding: 16px 18px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap: 12px;
      }

      .drink-upsell-title{
        margin: 0;
        font-size: 1.2rem;
        font-weight: 900;
        color: #171717;
      }

      .drink-upsell-sub{
        margin-top: 4px;
        color: rgba(0,0,0,.62);
        font-weight: 600;
        line-height: 1.4;
      }

      .drink-upsell-close{
        border: 1px solid rgba(0,0,0,.10);
        background: #fff;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        font-size: 20px;
        line-height: 1;
        font-weight: 900;
      }

      .drink-upsell-body{
        padding: 16px 18px 18px;
        max-height: calc(90vh - 84px);
        overflow: auto;
      }

      .drink-upsell-note{
        display:inline-flex;
        align-items:center;
        gap: 8px;
        padding: 7px 11px;
        border-radius: 999px;
        background: rgba(255, 193, 7, .16);
        border: 1px solid rgba(0,0,0,.08);
        font-weight: 800;
        margin-bottom: 14px;
      }

      .drink-added-badge{
        display:inline-flex;
        align-items:center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(25, 135, 84, .10);
        border: 1px solid rgba(25, 135, 84, .18);
        color: #198754;
        font-weight: 800;
        font-size: .85rem;
      }

      .drink-card{
        height: 100%;
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 20px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 10px 20px rgba(0,0,0,.05);
      }

      .drink-card-img{
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        background: #f5f5f5;
      }

      .drink-card-body{
        padding: 12px;
      }

      .drink-card-name{
        font-weight: 900;
        color: #111827;
        line-height: 1.25;
        min-height: 2.6em;
      }

      .drink-card-meta{
        color: rgba(0,0,0,.56);
        font-size: .88rem;
        min-height: 1.4em;
        margin-top: 4px;
      }

      .drink-card-price{
        margin-top: 8px;
        font-weight: 900;
        color: #111827;
      }

      .btn-duu{
        background: var(--duu-yellow);
        color: #1f1f1f;
        border: none;
        font-weight: 800;
      }

      .btn-duu:hover{ filter: brightness(.96); }
    `}</style>
  );
}

function DrinkUpsellModal(props: {
  open: boolean;
  products: Product[];
  loading: boolean;
  addingId: number | null;
  addedIds: number[];
  onClose: () => void;
  onAdd: (product: Product) => void;
  onSkip: () => void;
}) {
  const { open, products, loading, addingId, addedIds, onClose, onAdd, onSkip } = props;

  if (!open) return null;

  return (
    <div className="drink-upsell-backdrop" onClick={onClose}>
      <div
        className="drink-upsell-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drink-upsell-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drink-upsell-head">
          <div>
            <h2 id="drink-upsell-title" className="drink-upsell-title">
              Complétez votre repas
            </h2>
            <div className="drink-upsell-sub">
              Choisissez une ou plusieurs boissons avant de passer au paiement.
            </div>
          </div>

          <button
            type="button"
            className="drink-upsell-close"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
          >
            ×
          </button>
        </div>

        <div className="drink-upsell-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div className="drink-upsell-note">🥤 Boissons disponibles</div>

            {addedIds.length > 0 && (
              <div className="drink-added-badge">✓ {addedIds.length} ajoutée(s)</div>
            )}
          </div>

          {loading ? (
            <div className="py-4 text-center text-muted">
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              Chargement des boissons…
            </div>
          ) : products.length === 0 ? (
            <div className="py-4 text-center text-muted">
              Aucune boisson disponible pour le moment.
            </div>
          ) : (
            <div className="row g-3">
              {products.map((p) => {
                const pid = Number((p as any)?.id || 0);
                const busy = addingId === pid;
                const alreadyAdded = addedIds.includes(pid);
                const cover = firstCoverOf(p);
                const price = getUnitPrice(p);

                return (
                  <div className="col-6 col-md-4 col-lg-3" key={pid}>
                    <div className="drink-card">
                      {cover ? (
                        <img
                          src={imgUrl(cover)}
                          alt={(p as any)?.name || "Boisson"}
                          className="drink-card-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="drink-card-img" />
                      )}

                      <div className="drink-card-body">
                        <div className="drink-card-name">{(p as any)?.name || "Boisson"}</div>

                        <div className="drink-card-meta">
                          {(p as any)?.sub_category_name ||
                            (p as any)?.subcategory_name ||
                            (p as any)?.category_name ||
                            (p as any)?.category?.name ||
                            "Boisson"}
                        </div>

                        <div className="drink-card-price">{mad(price)}</div>

                        <button
                          type="button"
                          className={"btn w-100 mt-2 " + (alreadyAdded ? "btn-outline-success" : "btn-duu")}
                          onClick={() => onAdd(p)}
                          disabled={busy}
                          aria-busy={busy}
                        >
                          {busy ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                              Ajout…
                            </>
                          ) : alreadyAdded ? (
                            "Ajouter encore"
                          ) : (
                            "Ajouter"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="d-flex justify-content-end mt-3">
            <button type="button" className="btn btn-outline-dark" onClick={onSkip}>
              Terminer et continuer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const nav = useNavigate();
  const { lines, add, setQtyLine, removeLine, clear, totalItems, totalAmount } = useCart();

  const safeLines = (lines || []) as any[];
  const hasItems = safeLines.length > 0;

  const [clearing, setClearing] = useState(false);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [changingLineId, setChangingLineId] = useState<string | null>(null);
  const [goingCheckout, setGoingCheckout] = useState(false);

  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [loadingDrinks, setLoadingDrinks] = useState(false);
  const [drinkSuggestions, setDrinkSuggestions] = useState<Product[]>([]);
  const [addingDrinkId, setAddingDrinkId] = useState<number | null>(null);
  const [checkoutIntent, setCheckoutIntent] = useState(false);
  const [addedDrinkIds, setAddedDrinkIds] = useState<number[]>([]);

  const cartSignature = useMemo(() => buildCartSignature(safeLines), [safeLines]);

  const hasFoodInCart = useMemo(() => {
    return safeLines.some((l) => isFoodProductLike(l));
  }, [safeLines]);


  const mainFoodShopId = useMemo(() => {
    const firstFood = safeLines.find((l) => isFoodProductLike(l));
    return Number(firstFood?.shop_id || 0) || null;
  }, [safeLines]);

  const upsellDismissKey = useMemo(() => {
    return `duumini_food_drink_upsell_closed:${cartSignature}`;
  }, [cartSignature]);

  const wasDismissedForThisCart = useMemo(() => {
    try {
      return sessionStorage.getItem(upsellDismissKey) === "1";
    } catch {
      return false;
    }
  }, [upsellDismissKey]);

  const onClear = useCallback(() => {
    if (clearing) return;
    setClearing(true);
    try {
      clear();
    } finally {
      setClearing(false);
    }
  }, [clearing, clear]);

  const onRemove = useCallback(
    (lineId: string) => {
      if (removingLineId !== null) return;
      setRemovingLineId(lineId);
      try {
        removeLine(lineId);
      } finally {
        setRemovingLineId(null);
      }
    },
    [removingLineId, removeLine]
  );

  const onChangeQty = useCallback(
    (lineId: string, next: number) => {
      if (changingLineId !== null) return;
      const safeNext = Math.max(0, Math.min(999, Math.floor(next || 0)));
      setChangingLineId(lineId);
      try {
        if (safeNext <= 0) removeLine(lineId);
        else setQtyLine(lineId, safeNext);
      } finally {
        setChangingLineId(null);
      }
    },
    [changingLineId, setQtyLine, removeLine]
  );

  const closeDrinkModal = useCallback(() => {
    setDrinkModalOpen(false);
    setCheckoutIntent(false);
    setAddedDrinkIds([]);
  }, []);

  const proceedToCheckout = useCallback(() => {
    if (goingCheckout) return;
    setGoingCheckout(true);
    try {
      nav("/checkout");
    } finally {
      window.setTimeout(() => setGoingCheckout(false), 800);
    }
  }, [goingCheckout, nav]);

  const continueWithoutDrink = useCallback(() => {
    try {
      sessionStorage.setItem(upsellDismissKey, "1");
    } catch {}

    setDrinkModalOpen(false);
    setAddedDrinkIds([]);

    if (checkoutIntent) {
      setCheckoutIntent(false);
      proceedToCheckout();
    }
  }, [checkoutIntent, proceedToCheckout, upsellDismissKey]);

  const loadDrinkSuggestions = useCallback(async () => {
    if (!hasFoodInCart) {
      setDrinkSuggestions([]);
      return;
    }

    setLoadingDrinks(true);
    try {
      const res: any = await listProducts({
        page: 1,
        pageSize: 60,
        channel: "african-food",
        onlyActive: true,
      } as any);

      const all = Array.isArray(res?.items) ? res.items : [];

      const categoryDrinks = all.filter((p: any) => isDrinkCategoryLike(p));

      const sameShop = mainFoodShopId
        ? categoryDrinks.filter((p: any) => Number(p?.shop_id || 0) === mainFoodShopId)
        : [];

      const fallback = categoryDrinks.filter((p: any) => Number(p?.shop_id || 0) !== mainFoodShopId);

      const merged = [...sameShop, ...fallback]
        .filter((p: any, idx: number, arr: any[]) => {
          const id = Number(p?.id || 0);
          return id > 0 && arr.findIndex((x: any) => Number(x?.id || 0) === id) === idx;
        })
        .slice(0, 12);

      setDrinkSuggestions(merged);
    } catch {
      setDrinkSuggestions([]);
    } finally {
      setLoadingDrinks(false);
    }
  }, [hasFoodInCart, mainFoodShopId]);

  useEffect(() => {
    loadDrinkSuggestions();
  }, [loadDrinkSuggestions]);

  const onAddDrink = useCallback(
    (product: Product) => {
      const pid = Number((product as any)?.id || 0);
      if (!pid || addingDrinkId !== null) return;

      setAddingDrinkId(pid);
      try {
        add(product, 1);
        setAddedDrinkIds((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
      } finally {
        setAddingDrinkId(null);
      }
    },
    [add, addingDrinkId]
  );

  const goCheckout = useCallback(() => {
    if (goingCheckout) return;

    const shouldUpsell =
      hasItems &&
      hasFoodInCart &&
      !wasDismissedForThisCart &&
      drinkSuggestions.length > 0;

    if (shouldUpsell) {
      setCheckoutIntent(true);
      setAddedDrinkIds([]);
      setDrinkModalOpen(true);
      return;
    }

    proceedToCheckout();
  }, [
    goingCheckout,
    hasItems,
    hasFoodInCart,
    wasDismissedForThisCart,
    drinkSuggestions.length,
    proceedToCheckout,
  ]);

  const headerRight = useMemo(() => {
    if (!hasItems) return null;
    return (
      <div className="text-end">
        <div className="small text-muted">Articles</div>
        <div className="h5 m-0">{totalItems}</div>
        <div className="small text-muted">Sous-total {mad(totalAmount)}</div>
      </div>
    );
  }, [hasItems, totalItems, totalAmount]);

  return (
    <section className="container-xxl py-4 cart-page">
      <FocusAndLoadingStyle />

      <DrinkUpsellModal
        open={drinkModalOpen}
        products={drinkSuggestions}
        loading={loadingDrinks}
        addingId={addingDrinkId}
        addedIds={addedDrinkIds}
        onClose={closeDrinkModal}
        onAdd={onAddDrink}
        onSkip={continueWithoutDrink}
      />

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0">Votre panier</h1>

        <div className="d-flex align-items-center gap-2">
          {headerRight}

          {hasItems && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={onClear}
              aria-label="Vider le panier"
              disabled={clearing}
              aria-busy={clearing}
            >
              {clearing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Vidage…<span className="visually-hidden">du panier</span>
                </>
              ) : (
                "Vider"
              )}
            </button>
          )}
        </div>
      </div>

      {!hasItems ? (
        <div className="text-center text-muted py-5">
          <p className="mb-3">Votre panier est vide.</p>
          <Link to="/" className="btn btn-dark">
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Image</th>
                  <th>Produit</th>
                  <th className="text-end" style={{ width: 140 }}>
                    Prix
                  </th>
                  <th className="text-center" style={{ width: 200 }}>
                    Quantité
                  </th>
                  <th className="text-end" style={{ width: 140 }}>
                    Total
                  </th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>

              <tbody>
                {safeLines.map((l: any) => {
                  const lineId = getLineId(l);
                  const rowBusy = removingLineId === lineId || changingLineId === lineId;
                  const variantLabel = String(l?.variant?.label || "").trim();

                  return (
                    <tr key={lineId} aria-busy={rowBusy}>
                      <td>
                        {l.cover ? (
                          <img
                            src={imgUrl(l.cover)}
                            alt={l.name}
                            className="rounded"
                            style={{ width: 56, height: 56, objectFit: "cover" }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="bg-light rounded" style={{ width: 56, height: 56 }} />
                        )}
                      </td>

                      <td>
                        <Link to={`/products/${l.id}`} className="text-decoration-none text-dark">
                          {l.name}
                        </Link>

                        {variantLabel && (
                          <div className="small text-muted mt-1" style={{ lineHeight: 1.15 }}>
                            {variantLabel}
                          </div>
                        )}
                      </td>

                      <td className="text-end fw-semibold">{mad(l.price)}</td>

                      <td className="text-center">
                        <div
                          className="input-group input-group-sm"
                          style={{ maxWidth: 200, margin: "0 auto" }}
                        >
                          <button
                            className="btn btn-outline-dark"
                            onClick={() => onChangeQty(lineId, (l.qty || 0) - 1)}
                            aria-label="Diminuer la quantité"
                            disabled={rowBusy}
                            aria-busy={changingLineId === lineId}
                          >
                            {changingLineId === lineId ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            ) : (
                              "−"
                            )}
                          </button>

                          <input
                            className="form-control text-center"
                            inputMode="numeric"
                            value={Number(l.qty || 0)}
                            onChange={(e) => {
                              const raw = String(e.target.value || "");
                              const v = parseInt(raw.replace(/\D+/g, "") || "0", 10);
                              if (Number.isFinite(v) && v !== Number(l.qty || 0)) {
                                onChangeQty(lineId, v);
                              }
                            }}
                            disabled={rowBusy}
                            aria-busy={changingLineId === lineId}
                          />

                          <button
                            className="btn btn-outline-dark"
                            onClick={() => onChangeQty(lineId, (l.qty || 0) + 1)}
                            aria-label="Augmenter la quantité"
                            disabled={rowBusy}
                            aria-busy={changingLineId === lineId}
                          >
                            {changingLineId === lineId ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            ) : (
                              "+"
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="text-end fw-semibold">
                        {mad((l.qty || 0) * (l.price || 0))}
                      </td>

                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemove(lineId)}
                          aria-label="Retirer la ligne"
                          title="Retirer"
                          disabled={removingLineId === lineId}
                          aria-busy={removingLineId === lineId}
                        >
                          {removingLineId === lineId ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                          ) : (
                            "✕"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan={2} className="fw-semibold">
                    Total articles
                  </td>
                  <td colSpan={1} className="text-end">
                    {totalItems}
                  </td>
                  <td className="fw-semibold text-end">Montant</td>
                  <td className="fw-bold text-end">{mad(totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-end gap-2 mt-3">
            <Link to="/" className="btn btn-outline-dark">
              Continuer mes achats
            </Link>

            <button
              className="btn btn-duu"
              onClick={goCheckout}
              disabled={goingCheckout}
              aria-busy={goingCheckout}
            >
              {goingCheckout ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Redirection…<span className="visually-hidden">vers la page de paiement</span>
                </>
              ) : (
                "Passer la commande"
              )}
            </button>
          </div>

          <style>{`
            .btn-duu{
              background: var(--duu-yellow);
              color: #1f1f1f;
              border: none;
            }
            .btn-duu:hover{ filter: brightness(0.95); }
          `}</style>
        </>
      )}
    </section>
  );
}
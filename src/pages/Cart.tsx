// src/pages/Cart.tsx
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, mad } from "../store/cart";
import { API_BASE } from "../services/http";

function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

/* ——— Style local : focus rouge + état loading ——— */
const FocusAndLoadingStyle = () => (
  <style>{`
    /* Focus rouge Duumini pour TOUS les boutons/inputs de cette page */
    .cart-page .btn:focus,
    .cart-page .btn:focus-visible,
    .cart-page .form-control:focus,
    .cart-page .form-select:focus {
      outline: none !important;
      box-shadow: 0 0 0 .25rem rgba(229, 57, 53, .35) !important; /* var(--duu-red) */
      border-color: #E53935 !important;
    }

    /* Curseur & opacité en mode loading */
    .cart-page .btn[aria-busy="true"],
    .cart-page .form-control[aria-busy="true"] {
      pointer-events: none;
      opacity: .9;
    }

    /* Accessibilité */
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
  `}</style>
);

export default function CartPage() {
  const nav = useNavigate();
  const { lines, setQty, remove, clear, totalItems, totalAmount } = useCart();
  const hasItems = lines.length > 0;

  // États de chargement
  const [clearing, setClearing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [changingQtyId, setChangingQtyId] = useState<number | null>(null);
  const [goingCheckout, setGoingCheckout] = useState(false);

  // Handlers avec indicateurs
  const onClear = () => {
    if (clearing) return;
    setClearing(true);
    try {
      clear();
    } finally {
      setClearing(false);
    }
  };

  const onRemove = (id: number) => {
    if (removingId !== null) return;
    setRemovingId(id);
    try {
      remove(id);
    } finally {
      setRemovingId(null);
    }
  };

  const onChangeQty = (id: number, next: number) => {
    if (changingQtyId !== null) return;
    setChangingQtyId(id);
    try {
      setQty(id, Math.max(0, next));
    } finally {
      setChangingQtyId(null);
    }
  };

  const goCheckout = () => {
    if (goingCheckout) return;
    setGoingCheckout(true);
    // navigation immédiate (le spinner s’affiche brièvement)
    nav("/checkout");
  };

  const headerRight = useMemo(
    () =>
      hasItems ? (
        <div className="text-end">
          <div className="small text-muted">Articles</div>
          <div className="h5 m-0">{totalItems}</div>
          <div className="small text-muted">Sous-total {mad(totalAmount)}</div>
        </div>
      ) : null,
    [hasItems, totalItems, totalAmount]
  );

  return (
    <section className="container-xxl py-4 cart-page">
      <FocusAndLoadingStyle />

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
                  Vidage…
                  <span className="visually-hidden">du panier</span>
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
          <Link to="/" className="btn btn-dark">Découvrir les produits</Link>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Image</th>
                  <th>Produit</th>
                  <th className="text-end" style={{ width: 140 }}>Prix</th>
                  <th className="text-center" style={{ width: 200 }}>Quantité</th>
                  <th className="text-end" style={{ width: 140 }}>Total</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const rowBusy = removingId === l.id || changingQtyId === l.id;
                  return (
                    <tr key={l.id} aria-busy={rowBusy}>
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
                      </td>
                      <td className="text-end fw-semibold">{mad(l.price)}</td>
                      <td className="text-center">
                        <div className="input-group input-group-sm" style={{ maxWidth: 200, margin: "0 auto" }}>
                          <button
                            className="btn btn-outline-dark"
                            onClick={() => onChangeQty(l.id, l.qty - 1)}
                            aria-label="Diminuer la quantité"
                            disabled={rowBusy}
                            aria-busy={changingQtyId === l.id}
                          >
                            {changingQtyId === l.id ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            ) : (
                              "−"
                            )}
                          </button>
                          <input
                            className="form-control text-center"
                            inputMode="numeric"
                            value={l.qty}
                            onChange={(e) => {
                              const v = parseInt(e.target.value.replace(/\D+/g, "") || "0", 10);
                              onChangeQty(l.id, v);
                            }}
                            disabled={rowBusy}
                            aria-busy={changingQtyId === l.id}
                          />
                          <button
                            className="btn btn-outline-dark"
                            onClick={() => onChangeQty(l.id, l.qty + 1)}
                            aria-label="Augmenter la quantité"
                            disabled={rowBusy}
                            aria-busy={changingQtyId === l.id}
                          >
                            {changingQtyId === l.id ? (
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            ) : (
                              "+"
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="text-end fw-semibold">{mad(l.qty * l.price)}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemove(l.id)}
                          aria-label="Retirer la ligne"
                          title="Retirer"
                          disabled={removingId === l.id}
                          aria-busy={removingId === l.id}
                        >
                          {removingId === l.id ? (
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
                  <td colSpan={2} className="fw-semibold">Total articles</td>
                  <td colSpan={1} className="text-end">{totalItems}</td>
                  <td className="fw-semibold text-end">Montant</td>
                  <td className="fw-bold text-end">{mad(totalAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-end gap-2 mt-3">
            <Link to="/" className="btn btn-outline-dark">Continuer mes achats</Link>
            <button
              className="btn btn-duu"
              onClick={goCheckout}
              disabled={goingCheckout}
              aria-busy={goingCheckout}
            >
              {goingCheckout ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Redirection…
                  <span className="visually-hidden">vers la page de paiement</span>
                </>
              ) : (
                "Passer la commande"
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

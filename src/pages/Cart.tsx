// src/pages/Cart.tsx
import { useMemo, useState, useCallback } from "react";
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
  `}</style>
);

export default function CartPage() {
  const nav = useNavigate();
  const { lines, setQtyLine, removeLine, clear, totalItems, totalAmount } = useCart();

  const safeLines = (lines || []) as any[];
  const hasItems = safeLines.length > 0;

  const [clearing, setClearing] = useState(false);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [changingLineId, setChangingLineId] = useState<string | null>(null);
  const [goingCheckout, setGoingCheckout] = useState(false);

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

  // ✅ 0 => supprime la ligne (UX plus clean)
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

  const goCheckout = useCallback(() => {
    if (goingCheckout) return;
    setGoingCheckout(true);
    try {
      nav("/checkout");
    } finally {
      window.setTimeout(() => setGoingCheckout(false), 800);
    }
  }, [goingCheckout, nav]);

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
                  // ✅ robuste même si line_id absent
                  const lineId = String(
                    l?.line_id || `${Number(l.id || 0)}:${String(l?.variant?.variant_key || "default")}`
                  );

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
                        <div className="input-group input-group-sm" style={{ maxWidth: 200, margin: "0 auto" }}>
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

                      <td className="text-end fw-semibold">{mad((l.qty || 0) * (l.price || 0))}</td>

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

            <button className="btn btn-duu" onClick={goCheckout} disabled={goingCheckout} aria-busy={goingCheckout}>
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

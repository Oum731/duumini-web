// src/pages/admin/PromotionsAdminPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listProducts,
  updateProduct,
  type Product,
  type PromoDiscountType,
  listManageProducts, // ✅ si présent dans services/products
} from "../../services/products";
import { me } from "../../services/auth";
import { api } from "../../services/http";

/* ===== Utils ===== */
function mad(n?: number | null) {
  const v = typeof n === "number" && !isNaN(n) ? n : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(v);
}

function isVendorRole(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return r === "VENDOR" || r === "VENDEUR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE";
}

/**
 * ✅ On considère "en promo" si promo_eligible=1 et promo_discount_value>0
 */
function isPromo(p: any) {
  return Number(p?.promo_eligible || 0) === 1 && Number(p?.promo_discount_value || 0) > 0;
}

function promoLabel(p: any) {
  if (!isPromo(p)) return "—";
  const t = String(p?.promo_discount_type || "").toUpperCase();
  const v = Number(p?.promo_discount_value || 0);
  if (t === "AMOUNT") return `-${mad(v)}`;
  return `-${Math.round(v)}%`;
}

/**
 * ✅ Prix base à afficher (admin) :
 * - si variants => on affiche min_price (sinon price)
 */
function basePriceForAdmin(p: any): number {
  const hasVariants = !!p?.has_variants || Number(p?.variants_count || 0) > 0;

  const minp: number | null = p?.min_price == null || p?.min_price === "" ? null : Number(p.min_price);
  const price: number = p?.price == null || p?.price === "" ? 0 : Number(p.price);

  if (hasVariants && minp != null && Number.isFinite(minp) && minp >= 0) return minp;
  return Number.isFinite(price) ? price : 0;
}

/**
 * ✅ Prix promo à afficher (admin) :
 * - si variants => min_promo_price (sinon promo_price)
 * - sinon => calc fallback local
 */
function computePromoPriceLocal(base: number, eligible: number, type: any, value: any) {
  if (Number(eligible) !== 1) return null;
  const b = Number(base);
  const v = Number(value);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (!Number.isFinite(v) || v <= 0) return null;

  const t = String(type || "").toUpperCase();
  let out = b;

  if (t === "AMOUNT") out = b - v;
  else out = b * (1 - v / 100);

  if (!Number.isFinite(out)) return null;
  if (out < 0) out = 0;
  return +out.toFixed(2);
}

function promoPriceForAdmin(p: any): number | null {
  const hasVariants = !!p?.has_variants || Number(p?.variants_count || 0) > 0;

  const apiPromo = hasVariants ? p?.min_promo_price : p?.promo_price;
  const apiPromoN: number | null = apiPromo == null || apiPromo === "" ? null : Number(apiPromo);

  if (apiPromoN != null && Number.isFinite(apiPromoN)) return apiPromoN;

  const base = basePriceForAdmin(p);
  return computePromoPriceLocal(
    base,
    Number(p?.promo_eligible || 0),
    p?.promo_discount_type,
    p?.promo_discount_value
  );
}

function unwrap<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res) return res.data as T;
  return res as T;
}

/* ========================= */

export default function PromotionsAdminPage() {
  const [tab, setTab] = useState<"ADD" | "REMOVE">("ADD");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [all, setAll] = useState<Product[]>([]);

  // ✅ rôle
  const [role, setRole] = useState<string | null>(null);
  const isVendor = isVendorRole(role);

  const promoItems = useMemo(() => all.filter((p: any) => isPromo(p)), [all]);

  const [qAll, setQAll] = useState("");
  const [qPromo, setQPromo] = useState("");

  const [selectedAdd, setSelectedAdd] = useState<Record<number, boolean>>({});
  const [selectedRemove, setSelectedRemove] = useState<Record<number, boolean>>({});

  const selectedAddIds = useMemo(
    () =>
      Object.entries(selectedAdd)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selectedAdd]
  );

  const selectedRemoveIds = useMemo(
    () =>
      Object.entries(selectedRemove)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selectedRemove]
  );

  const filteredAll = useMemo(() => {
    const s = qAll.trim().toLowerCase();
    if (!s) return all;
    return all.filter((p: any) => {
      const name = String(p?.name || "").toLowerCase();
      const shop = String(p?.shop_name || "").toLowerCase();
      const id = String(p?.id || "");
      return name.includes(s) || shop.includes(s) || id.includes(s);
    });
  }, [all, qAll]);

  const filteredPromo = useMemo(() => {
    const s = qPromo.trim().toLowerCase();
    const base = promoItems;
    if (!s) return base;
    return base.filter((p: any) => {
      const name = String(p?.name || "").toLowerCase();
      const shop = String(p?.shop_name || "").toLowerCase();
      const id = String(p?.id || "");
      return name.includes(s) || shop.includes(s) || id.includes(s);
    });
  }, [promoItems, qPromo]);

  const refreshRole = useCallback(async () => {
    try {
      const u: any = await me();
      const r = String(u?.role || u?.user?.role || "").toUpperCase();
      setRole(r || null);
    } catch {
      setRole(null);
    }
  }, []);

  /**
   * ✅ LOAD:
   * - VENDEUR => on charge uniquement SES produits via /api/products/manage (ou endpoint équivalent)
   * - ADMIN => on garde listProducts (tous)
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // s'assurer d'avoir le rôle
      let r = role;
      if (!r) {
        try {
          const u: any = await me();
          r = String(u?.role || u?.user?.role || "").toUpperCase();
          setRole(r || null);
        } catch {
          r = null;
          setRole(null);
        }
      }

      const vendor = isVendorRole(r);

      // ✅ VENDEUR: liste manage => backend filtre automatiquement par vendeur
      if (vendor) {
        // 1) si le service listManageProducts existe, on l’utilise
        if (typeof listManageProducts === "function") {
          const res = await listManageProducts({
            page: 1,
            pageSize: 1000,
            onlyActive: false,
          } as any);
          setAll(Array.isArray(res?.items) ? (res.items as Product[]) : []);
          return;
        }

        // 2) fallback direct API (si ton service n'est pas exposé)
        const resRaw = await api.get<any>("/api/products/manage", { query: { page: 1, pageSize: 1000 } as any });
        const body = unwrap<any>(resRaw);
        const items = Array.isArray(body?.items) ? body.items : Array.isArray(body?.data?.items) ? body.data.items : [];
        setAll(items as Product[]);
        return;
      }

      // ✅ ADMIN: tous les produits
      const res = await listProducts({ page: 1, pageSize: 1000 } as any);
      const items = Array.isArray(res?.items) ? (res.items as Product[]) : [];
      setAll(items);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    (async () => {
      await refreshRole();
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAllAdd = (on: boolean) => {
    const next: Record<number, boolean> = {};
    for (const p of filteredAll as any[]) next[Number(p.id)] = on;
    setSelectedAdd(next);
  };

  const toggleAllRemove = (on: boolean) => {
    const next: Record<number, boolean> = {};
    for (const p of filteredPromo as any[]) next[Number(p.id)] = on;
    setSelectedRemove(next);
  };

  // ===== Modal apply promo =====
  const [modalOpen, setModalOpen] = useState(false);
  const [promoType, setPromoType] = useState<PromoDiscountType>("PERCENT");
  const [promoValue, setPromoValue] = useState<string>("");

  const openApplyModal = () => {
    if (!selectedAddIds.length) return;
    setPromoType("PERCENT");
    setPromoValue("");
    setError(null);
    setModalOpen(true);
  };

  const applyPromo = async () => {
    const ids = selectedAddIds;
    const val = Number(promoValue);

    if (!ids.length) return;

    if (!Number.isFinite(val) || val <= 0) {
      setError("Veuillez saisir une réduction valide.");
      return;
    }
    if (promoType === "PERCENT" && val > 100) {
      setError("Le pourcentage ne peut pas dépasser 100%.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          updateProduct(
            id,
            {
              promo_eligible: 1,
              promo_discount_type: promoType,
              promo_discount_value: val,
            } as any,
            [],
            false
          )
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) setError(`${failed} produit(s) n’ont pas pu être mis en promotion.`);

      setSelectedAdd({});
      setModalOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disablePromo = async () => {
    const ids = selectedRemoveIds;
    if (!ids.length) return;

    setBusy(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          updateProduct(
            id,
            {
              promo_eligible: 0,
              promo_discount_type: null,
              promo_discount_value: null,
            } as any,
            [],
            false
          )
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) setError(`${failed} produit(s) n’ont pas pu être retirés de la promo.`);

      setSelectedRemove({});
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-xxl py-3 px-2 px-sm-3">
      <style>{`
        .btn-duu{ background: var(--duu-yellow, #fddc00); color:#1f1f1f; border:none; font-weight:900; }
        .btn-duu:hover{ filter: brightness(.96); }
        .badge-duu{ background: var(--duu-red, #e53935); }
      `}</style>

      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2">
        <div>
          <div className="fw-semibold" style={{ color: "var(--duu-black)" }}>
            Promotions
          </div>
          <div className="text-muted small">Sélectionne des produits puis applique / retire une réduction.</div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-sm btn-outline-dark" onClick={load} disabled={loading || busy}>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
      </div>

      {isVendor ? (
        <div className="alert alert-info py-2 mb-2">
          Mode vendeur : tu vois uniquement <b>tes produits</b>.
        </div>
      ) : null}

      {error ? <div className="alert alert-danger py-2 mb-2">{error}</div> : null}

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex gap-2 flex-wrap mb-2">
            <button
              className={`btn btn-sm ${tab === "ADD" ? "btn-duu" : "btn-outline-dark"}`}
              onClick={() => setTab("ADD")}
              disabled={busy}
            >
              Ajouter une promotion
            </button>
            <button
              className={`btn btn-sm ${tab === "REMOVE" ? "btn-duu" : "btn-outline-dark"}`}
              onClick={() => setTab("REMOVE")}
              disabled={busy}
            >
              Désactiver une promotion
            </button>

            <div className="ms-auto d-flex gap-2 flex-wrap">
              {tab === "ADD" ? (
                <>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => toggleAllAdd(true)}
                    disabled={busy || loading || !filteredAll.length}
                  >
                    Tout cocher
                  </button>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => toggleAllAdd(false)}
                    disabled={busy || loading}
                  >
                    Tout décocher
                  </button>
                  <button
                    className="btn btn-sm btn-duu"
                    onClick={openApplyModal}
                    disabled={busy || loading || selectedAddIds.length === 0}
                  >
                    Valider ({selectedAddIds.length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => toggleAllRemove(true)}
                    disabled={busy || loading || !filteredPromo.length}
                  >
                    Tout cocher
                  </button>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => toggleAllRemove(false)}
                    disabled={busy || loading}
                  >
                    Tout décocher
                  </button>
                  <button
                    className="btn btn-sm btn-duu"
                    onClick={disablePromo}
                    disabled={busy || loading || selectedRemoveIds.length === 0}
                  >
                    Désactiver ({selectedRemoveIds.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {tab === "ADD" ? (
            <>
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Rechercher produit (nom, boutique, id)…"
                  value={qAll}
                  onChange={(e) => setQAll(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="table table-sm align-middle mb-0">
                  <thead className="sticky-top bg-white">
                    <tr>
                      <th style={{ width: 44 }} />
                      <th>Produit</th>
                      <th className="d-none d-md-table-cell">Boutique</th>
                      <th className="text-end">Prix</th>
                      <th className="text-end">Promo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-muted small py-3">
                          Chargement…
                        </td>
                      </tr>
                    ) : filteredAll.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-muted small py-3">
                          Aucun produit.
                        </td>
                      </tr>
                    ) : (
                      filteredAll.map((p: any) => {
                        const base = basePriceForAdmin(p);
                        const promoP = promoPriceForAdmin(p);
                        const showPromoLine = promoP != null && isPromo(p);

                        return (
                          <tr key={p.id}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!selectedAdd[p.id]}
                                onChange={(e) =>
                                  setSelectedAdd((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.checked,
                                  }))
                                }
                                disabled={busy}
                              />
                            </td>

                            <td className="text-truncate" style={{ maxWidth: 360 }}>
                              <div className="fw-semibold text-truncate">{p.name}</div>
                              <div className="text-muted small">#{p.id}</div>
                            </td>

                            <td className="d-none d-md-table-cell text-truncate" style={{ maxWidth: 240 }}>
                              {p.shop_name || "—"}
                            </td>

                            <td className="text-end">
                              <div className="fw-semibold">
                                {mad(base)}
                                {p.has_variants || Number(p.variants_count || 0) > 0 ? (
                                  <span className="text-muted small ms-1">(min)</span>
                                ) : null}
                              </div>

                              {showPromoLine ? (
                                <div className="text-muted small">
                                  Nouveau : <b>{mad(promoP)}</b>
                                </div>
                              ) : null}
                            </td>

                            <td className="text-end">
                              <span className={`badge ${isPromo(p) ? "badge-duu text-white" : "bg-light text-dark"}`}>
                                {promoLabel(p)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-muted small mt-2">
                Tu peux aussi sélectionner des produits déjà en promo pour modifier leur réduction.
              </div>
            </>
          ) : (
            <>
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Rechercher produit en promo…"
                  value={qPromo}
                  onChange={(e) => setQPromo(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="table-responsive" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="table table-sm align-middle mb-0">
                  <thead className="sticky-top bg-white">
                    <tr>
                      <th style={{ width: 44 }} />
                      <th>Produit (en promo)</th>
                      <th className="d-none d-md-table-cell">Boutique</th>
                      <th className="text-end">Prix</th>
                      <th className="text-end">Promo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-muted small py-3">
                          Chargement…
                        </td>
                      </tr>
                    ) : filteredPromo.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-muted small py-3">
                          Aucun produit en promotion.
                        </td>
                      </tr>
                    ) : (
                      filteredPromo.map((p: any) => {
                        const base = basePriceForAdmin(p);
                        const promoP = promoPriceForAdmin(p);

                        return (
                          <tr key={p.id}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!selectedRemove[p.id]}
                                onChange={(e) =>
                                  setSelectedRemove((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.checked,
                                  }))
                                }
                                disabled={busy}
                              />
                            </td>

                            <td className="text-truncate" style={{ maxWidth: 360 }}>
                              <div className="fw-semibold text-truncate">{p.name}</div>
                              <div className="text-muted small">#{p.id}</div>
                            </td>

                            <td className="d-none d-md-table-cell text-truncate" style={{ maxWidth: 240 }}>
                              {p.shop_name || "—"}
                            </td>

                            <td className="text-end">
                              <div className="fw-semibold">
                                {mad(base)}
                                {p.has_variants || Number(p.variants_count || 0) > 0 ? (
                                  <span className="text-muted small ms-1">(min)</span>
                                ) : null}
                              </div>
                              {promoP != null ? (
                                <div className="text-muted small">
                                  Nouveau : <b>{mad(promoP)}</b>
                                </div>
                              ) : null}
                            </td>

                            <td className="text-end">
                              <span className="badge badge-duu text-white">{promoLabel(p)}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== Modal appliquer promo ===== */}
      {modalOpen ? (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          style={{ background: "rgba(0,0,0,.35)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModalOpen(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Appliquer une promotion</h5>
                <button type="button" className="btn-close" onClick={() => !busy && setModalOpen(false)} />
              </div>

              <div className="modal-body">
                <div className="text-muted small mb-2">
                  Produits sélectionnés : <b>{selectedAddIds.length}</b>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small">Type de réduction</label>
                    <select
                      className="form-select"
                      value={promoType}
                      onChange={(e) => setPromoType(e.target.value as PromoDiscountType)}
                      disabled={busy}
                    >
                      <option value="PERCENT">Pourcentage (%)</option>
                      <option value="AMOUNT">Montant (MAD)</option>
                    </select>
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small">
                      Valeur {promoType === "PERCENT" ? "(ex: 10)" : "(ex: 20)"}
                    </label>
                    <input
                      className="form-control"
                      value={promoValue}
                      onChange={(e) => setPromoValue(e.target.value)}
                      placeholder={promoType === "PERCENT" ? "10" : "20"}
                      disabled={busy}
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="text-muted small mt-2">
                  {promoType === "PERCENT" ? "Ex: 10 = -10% sur le prix." : "Ex: 20 = -20 MAD sur le prix."}
                </div>

                {/* ✅ Aperçu */}
                <div className="mt-3 p-2 rounded bg-light">
                  <div className="small text-muted mb-1">Aperçu (exemple)</div>
                  {(() => {
                    const exampleBase = 120;
                    const v = Number(promoValue);
                    const preview =
                      Number.isFinite(v) && v > 0 ? computePromoPriceLocal(exampleBase, 1, promoType, v) : null;

                    return (
                      <div className="small">
                        Prix base: <b>{mad(exampleBase)}</b> → Nouveau: <b>{preview == null ? "—" : mad(preview)}</b>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={() => setModalOpen(false)} disabled={busy}>
                  Annuler
                </button>
                <button className="btn btn-duu" onClick={applyPromo} disabled={busy}>
                  {busy ? "Application…" : "Appliquer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
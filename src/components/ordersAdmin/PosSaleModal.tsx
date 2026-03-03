// src/components/ordersAdmin/PosSaleModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProducts, type Product } from "../../services/products";
import {
  createOrder,
  updateOrderStatus,
  type OrderStatus,
} from "../../services/orders";

type AnyObj = Record<string, any>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** appelé après création (ex: refresh liste) */
  onCreated?: () => void | Promise<void>;
};

const mad = (n?: number | null) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

function numSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInputNumberValue(n: number) {
  return n === 0 ? "" : String(n);
}
function fromInputNumberValue(v: string) {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeRemaining(total: number, paid: number) {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  return Math.max(0, t - p);
}

type PayStatus = "PAID" | "UNPAID" | "PARTIAL";
function computePayStatus(total: number, paid: number): PayStatus {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  if (t <= 0 || p <= 0) return "UNPAID";
  if (p >= t) return "PAID";
  return "PARTIAL";
}

function getProductUnitPrice(p: Product): number {
  const anyP = p as AnyObj;

  const promo =
    anyP.promo_price ??
    anyP.promoPrice ??
    anyP.price_promo ??
    anyP.sale_price ??
    anyP.salePrice ??
    anyP.final_price ??
    anyP.finalPrice ??
    anyP.discounted_price ??
    null;

  const base = anyP.price ?? 0;

  const promoNum = Number(promo);
  if (Number.isFinite(promoNum) && promoNum > 0 && promoNum < Number(base || Infinity)) return promoNum;

  const baseNum = Number(base);
  return Number.isFinite(baseNum) ? baseNum : 0;
}

function hasPromo(p: Product): boolean {
  const anyP = p as AnyObj;
  const promo =
    anyP.promo_price ??
    anyP.promoPrice ??
    anyP.price_promo ??
    anyP.sale_price ??
    anyP.salePrice ??
    anyP.final_price ??
    anyP.finalPrice ??
    anyP.discounted_price ??
    null;

  const base = Number(anyP.price ?? 0);
  const promoNum = Number(promo);
  return Number.isFinite(promoNum) && promoNum > 0 && promoNum < base;
}

/**
 * ✅ POS / Vente sur place
 * - Charge tous les produits (pagination)
 * - Panier + qty
 * - Saisie paiement
 * - Crée une commande PICKUP (fee=0) + payment
 */
export default function PosSaleModal({ open, onClose, onCreated }: Props) {
  // client (facultatif)
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cPhone, setCPhone] = useState("");

  // panier
  const [basket, setBasket] = useState<{ product: Product; qty: number }[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [markDone, setMarkDone] = useState(true);

  // catalogue
  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"ALL" | "PROMO" | "NO_PROMO">("ALL");
  const [sortBy, setSortBy] = useState<"NAME" | "PRICE_ASC" | "PRICE_DESC">("NAME");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const searchAbort = useRef<AbortController | null>(null);

  const [saving, setSaving] = useState(false);

  const basketTotal = useMemo(() => {
    return basket.reduce((s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0), 0);
  }, [basket]);

  const paidClamped = useMemo(() => {
    const t = Math.max(0, numSafe(basketTotal));
    const p = Math.max(0, Math.min(numSafe(amountPaid), t));
    return p;
  }, [basketTotal, amountPaid]);

  const remaining = useMemo(() => computeRemaining(basketTotal, paidClamped), [basketTotal, paidClamped]);
  const payStatus = useMemo(() => computePayStatus(basketTotal, paidClamped), [basketTotal, paidClamped]);

  useEffect(() => {
    if (paidClamped !== amountPaid) setAmountPaid(paidClamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidClamped]);

  const reset = useCallback(() => {
    setSearch("");
    setPromoFilter("ALL");
    setSortBy("NAME");
    setSearchErr(null);
    setSearchLoading(false);
    setResults([]);
    setBasket([]);
    setAmountPaid(0);
    setCFirst("");
    setCLast("");
    setCPhone("");
    setMarkDone(true);
    setSaving(false);
  }, []);

  // reset quand on ferme
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function addToBasket(p: Product) {
    setBasket((prev) => {
      const idx = prev.findIndex((x) => x.product.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function setQty(pId: number, qty: number) {
    setBasket((prev) =>
      prev.map((x) => (x.product.id === pId ? { ...x, qty: Math.max(1, qty) } : x)),
    );
  }

  function removeLine(pId: number) {
    setBasket((prev) => prev.filter((x) => x.product.id !== pId));
  }

  function clearBasket() {
    if (!basket.length) return;
    if (!window.confirm("Vider le panier ?")) return;
    setBasket([]);
    setAmountPaid(0);
  }

  const loadAllProducts = useCallback(async () => {
    if (!open) return;

    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;

    setSearchLoading(true);
    setSearchErr(null);

    try {
      const pageSizeAll = 100;
      let page = 1;
      let all: Product[] = [];
      let totalExpected = Infinity;

      while (!ac.signal.aborted) {
        const res = await listProducts({ page, pageSize: pageSizeAll } as any);
        if (ac.signal.aborted) return;

        const batch = (res.items || []) as Product[];
        all = all.concat(batch);

        const t = Number(res.pageInfo?.total ?? all.length);
        if (Number.isFinite(t)) totalExpected = t;

        if (all.length >= totalExpected) break;
        if (batch.length === 0) break;

        page += 1;
        if (page > 200) break;
      }

      if (ac.signal.aborted) return;

      const map = new Map<number, Product>();
      all.forEach((p) => map.set(p.id, p));
      setResults(Array.from(map.values()));
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setSearchErr(e?.message || "Impossible de charger les produits.");
    } finally {
      if (!ac.signal.aborted) setSearchLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadAllProducts();
    return () => {
      searchAbort.current?.abort();
    };
  }, [open, loadAllProducts]);

  const filteredResults = useMemo(() => {
    const ql = search.trim().toLowerCase();
    let arr = results;

    if (promoFilter === "PROMO") arr = arr.filter((p) => hasPromo(p));
    if (promoFilter === "NO_PROMO") arr = arr.filter((p) => !hasPromo(p));

    if (ql) {
      arr = arr.filter((p) => {
        const anyP = p as AnyObj;
        const name = String(p.name || "").toLowerCase();
        const sku = String(anyP.sku || anyP.ref || anyP.code || "").toLowerCase();
        return name.includes(ql) || (sku && sku.includes(ql));
      });
    }

    const sorted = [...arr];
    if (sortBy === "NAME") sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
    else if (sortBy === "PRICE_ASC") sorted.sort((a, b) => getProductUnitPrice(a) - getProductUnitPrice(b));
    else if (sortBy === "PRICE_DESC") sorted.sort((a, b) => getProductUnitPrice(b) - getProductUnitPrice(a));
    return sorted;
  }, [results, search, promoFilter, sortBy]);

  async function submitCreate() {
    if (basket.length === 0) {
      alert("Ajoutez au moins un produit.");
      return;
    }

    const total = Math.max(0, numSafe(basketTotal));
    const paid = paidClamped;
    const remain = computeRemaining(total, paid);
    const status = computePayStatus(total, paid);

    const itemsPayload = basket.map((b) => {
      const unit = getProductUnitPrice(b.product);
      return {
        product_id: b.product.id,
        qty: b.qty,
        name: b.product.name,
        price: Number(unit || 0),
      };
    });

    const payload = {
      contact: { first_name: cFirst || "", last_name: cLast || "", phone: cPhone || "" },
      address: { ville: "Casablanca", commune: "Sur place", quartier: "Boutique", gps: null },
      delivery: { mode: "PICKUP" as const, fee: 0, currency: "MAD" as const },
      items: itemsPayload,
      totals: {
        items_count: itemsPayload.reduce((s, it) => s + it.qty, 0),
        items_amount: total,
        delivery_fee: 0,
        amount: total,
        currency: "MAD",
      },
      payment: {
        method: "CASH",
        note: `Vente sur place | ${status} | payé=${paid} | reste=${remain}`,
        paid_amount: paid,
        status,
      },
    };

    try {
      setSaving(true);
      const created = await createOrder(payload as any);

      if (markDone && created?.id) {
        await updateOrderStatus(created.id, "DONE" as OrderStatus);
      }

      if (onCreated) await onCreated();

      onClose();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
      <div className="modal-dialog modal-xl" role="document">
        <div className="modal-content pos-modal">
          <div className="modal-header pos-sticky-header">
            <h5 className="modal-title">Vente sur place</h5>
            <button className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body pos-body">
            <div className="row g-3 pos-grid">
              {/* Catalogue */}
              <div className="col-12 col-lg-7 pos-col">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div>
                        <h6 className="mb-0">Catalogue</h6>
                        <div className="text-muted small">Ajoute des produits au panier</div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-dark"
                        onClick={loadAllProducts}
                        disabled={searchLoading || saving}
                      >
                        Rafraîchir
                      </button>
                    </div>

                    <div className="row g-2 mt-2">
                      <div className="col-12 col-md-6">
                        <input
                          className="form-control"
                          placeholder="Rechercher (nom, sku)…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="col-12 col-md-3">
                        <select
                          className="form-select"
                          value={promoFilter}
                          onChange={(e) => setPromoFilter(e.target.value as any)}
                          disabled={saving}
                        >
                          <option value="ALL">Tous</option>
                          <option value="PROMO">Promos</option>
                          <option value="NO_PROMO">Sans promo</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-3">
                        <select
                          className="form-select"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          disabled={saving}
                        >
                          <option value="NAME">Nom</option>
                          <option value="PRICE_ASC">Prix ↑</option>
                          <option value="PRICE_DESC">Prix ↓</option>
                        </select>
                      </div>
                    </div>

                    {searchErr && <div className="alert alert-danger mt-2 mb-0">{searchErr}</div>}

                    <div className="mt-2 pos-scroll">
                      {searchLoading ? (
                        <div className="text-muted">Chargement de tous les produits…</div>
                      ) : (
                        <div className="vstack gap-2">
                          {filteredResults.map((p) => {
                            const unit = getProductUnitPrice(p);
                            const promo = hasPromo(p);
                            const base = Number((p as AnyObj)?.price ?? unit);

                            return (
                              <div
                                key={p.id}
                                className="d-flex justify-content-between align-items-center border rounded p-2"
                              >
                                <div className="text-truncate" style={{ maxWidth: 420 }}>
                                  <div className="fw-semibold text-truncate d-flex align-items-center gap-2">
                                    <span className="text-truncate">{p.name}</span>
                                    {promo ? <span className="badge bg-danger">Promo</span> : null}
                                  </div>

                                  <div className="text-muted small">
                                    {promo ? (
                                      <>
                                        <span className="text-decoration-line-through me-2">{mad(base)}</span>
                                        <span className="fw-semibold text-dark">{mad(unit)}</span>
                                      </>
                                    ) : (
                                      <span className="fw-semibold text-dark">{mad(unit)}</span>
                                    )}
                                  </div>
                                </div>

                                <button className="btn btn-sm btn-duu" onClick={() => addToBasket(p)} disabled={saving}>
                                  Ajouter
                                </button>
                              </div>
                            );
                          })}

                          {filteredResults.length === 0 && <div className="text-muted small">Aucun produit.</div>}
                        </div>
                      )}

                      <div className="small text-muted mt-2">{results.length} produits chargés</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panier */}
              <div className="col-12 col-lg-5 pos-col">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <h6 className="mb-0">Panier & Paiement</h6>
                        <div className="text-muted small">Tout est ici, sans scroller jusqu’en bas</div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={clearBasket}
                        disabled={!basket.length || saving}
                      >
                        Vider
                      </button>
                    </div>

                    <div className="pos-summary mt-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Total</span>
                        <span className="fw-semibold">{mad(basketTotal)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Payé</span>
                        <span className="fw-semibold">{mad(paidClamped)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Reste</span>
                        <span className="fw-semibold">{mad(remaining)}</span>
                      </div>
                      <div className="mt-2">
                        <span
                          className={`badge ${
                            payStatus === "PAID"
                              ? "bg-success"
                              : payStatus === "PARTIAL"
                                ? "bg-warning text-dark"
                                : "bg-secondary"
                          }`}
                        >
                          {payStatus === "PAID" ? "PAYÉ" : payStatus === "PARTIAL" ? "PARTIEL" : "NON PAYÉ"}
                        </span>
                      </div>
                    </div>

                    <div className="vstack gap-2 mt-2 pos-scroll">
                      {basket.length === 0 ? (
                        <div className="text-muted small">Aucun article.</div>
                      ) : (
                        basket.map((ln) => {
                          const unit = getProductUnitPrice(ln.product);
                          const promo = hasPromo(ln.product);
                          const base = Number((ln.product as AnyObj)?.price ?? unit);

                          return (
                            <div
                              key={ln.product.id}
                              className="d-flex align-items-center justify-content-between border rounded p-2"
                            >
                              <div className="text-truncate" style={{ maxWidth: 220 }}>
                                <div className="fw-semibold text-truncate d-flex align-items-center gap-2">
                                  <span className="text-truncate">{ln.product.name}</span>
                                  {promo ? <span className="badge bg-danger">Promo</span> : null}
                                </div>
                                <div className="text-muted small">
                                  {promo ? (
                                    <>
                                      <span className="text-decoration-line-through me-2">{mad(base)}</span>
                                      <span className="fw-semibold text-dark">{mad(unit)}</span>
                                    </>
                                  ) : (
                                    <span className="fw-semibold text-dark">{mad(unit)}</span>
                                  )}
                                </div>
                              </div>

                              <div className="d-flex align-items-center gap-2">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  style={{ width: 80 }}
                                  min={1}
                                  value={ln.qty}
                                  onChange={(e) =>
                                    setQty(ln.product.id, Math.max(1, Number(e.target.value || 1)))
                                  }
                                  disabled={saving}
                                />
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeLine(ln.product.id)}
                                  disabled={saving}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <hr className="my-3" />

                    <h6 className="mb-2">Montant payé</h6>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className="form-control"
                      value={toInputNumberValue(amountPaid)}
                      onChange={(e) => setAmountPaid(fromInputNumberValue(e.target.value))}
                      disabled={saving}
                    />

                    <hr className="my-3" />

                    <h6 className="mb-2">Client (facultatif)</h6>
                    <div className="row g-2">
                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Prénom"
                          value={cFirst}
                          onChange={(e) => setCFirst(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Nom"
                          value={cLast}
                          onChange={(e) => setCLast(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="col-12">
                        <input
                          className="form-control"
                          placeholder="Téléphone (+212…)"
                          value={cPhone}
                          onChange={(e) => setCPhone(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div className="form-check mt-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="markDonePos"
                        checked={markDone}
                        onChange={(e) => setMarkDone(e.target.checked)}
                        disabled={saving}
                      />
                      <label className="form-check-label" htmlFor="markDonePos">
                        Marquer comme <strong>livrée (DONE)</strong> après création
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer pos-sticky-footer">
            <button className="btn btn-outline-dark" onClick={onClose} disabled={saving}>
              Fermer
            </button>
            <button className="btn btn-dark" onClick={submitCreate} disabled={saving || basket.length === 0}>
              {saving ? "Enregistrement…" : "Créer la vente"}
            </button>
          </div>

          <style>{`
            .btn-duu{
              background: var(--duu-yellow);
              color: #1f1f1f;
              border: none;
            }
            .btn-duu:hover{ filter: brightness(0.95); }

            .pos-modal{
              max-height: calc(100vh - 2rem);
              display: flex;
              flex-direction: column;
            }
            .pos-sticky-header{
              position: sticky;
              top: 0;
              z-index: 2;
              background: #fff;
              border-bottom: 1px solid rgba(0,0,0,.06);
            }
            .pos-body{
              overflow: auto;
              flex: 1 1 auto;
            }
            .pos-sticky-footer{
              position: sticky;
              bottom: 0;
              z-index: 2;
              background: #fff;
              border-top: 1px solid rgba(0,0,0,.06);
            }
            .pos-grid .pos-col{
              min-height: 520px;
            }
            .pos-scroll{
              max-height: 420px;
              overflow: auto;
            }
            .pos-summary{
              border: 1px solid rgba(0,0,0,.08);
              border-radius: 12px;
              padding: 10px 12px;
              background: #fff;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
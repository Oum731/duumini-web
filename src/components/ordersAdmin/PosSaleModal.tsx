// src/components/ordersAdmin/PosSaleModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProducts, type Product, isProductActive } from "../../services/products";
import {
  createAdminOrder,
  updateOrderStatus,
  type AdminDiscountType,
  type OrderStatus,
  type PaymentStatus,
} from "../../services/orders";
import { normalizePhone, isValidPhoneIntl } from "../../utils/phone";
import { LoadingState } from "../ui/Spinner";
import {
  listCommercialProfiles,
  type AdminCommercialProfile,
} from "../../services/commercialProfiles";

type AnyObj = Record<string, any>;
type CustomerRole = "CLIENT" | "VENDEUR";
type PosPaymentMethod = "BMCE" | "GAZHALA" | "CASH";

type Props = {
  open: boolean;
  onClose: () => void;
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

function clampMoney(n: number) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return +x.toFixed(2);
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

function computePayStatus(total: number, paid: number): PaymentStatus {
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
  if (Number.isFinite(promoNum) && promoNum > 0 && promoNum < Number(base || Infinity)) {
    return promoNum;
  }

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

function computeAdminDiscountAmount(
  itemsSubtotal: number,
  discountType: AdminDiscountType,
  discountValue: number
) {
  const subtotal = Math.max(0, numSafe(itemsSubtotal));
  const value = Math.max(0, numSafe(discountValue));

  if (subtotal <= 0 || value <= 0 || discountType === "NONE") return 0;

  let amount = 0;
  if (discountType === "AMOUNT") amount = value;
  else if (discountType === "PERCENT") amount = subtotal * (value / 100);

  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount > subtotal) amount = subtotal;

  return clampMoney(amount);
}

function normalizeCustomerRole(value: any): CustomerRole {
  return String(value || "").trim().toUpperCase() === "VENDEUR"
    ? "VENDEUR"
    : "CLIENT";
}

function normalizePaymentMethod(method: PosPaymentMethod) {
  if (method === "BMCE" || method === "GAZHALA") return "BANK_TRANSFER";
  return "CASH";
}

function getPaymentMethodLabel(method: PosPaymentMethod) {
  if (method === "BMCE") return "BMCE";
  if (method === "GAZHALA") return "GAZHALA";
  return "CASH";
}

export default function PosSaleModal({ open, onClose, onCreated }: Props) {
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cPhone, setCPhone] = useState("");

  const [cCity, setCCity] = useState("");
  const [cCommune, setCCommune] = useState("");
  const [cDistrict, setCDistrict] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cLandmark, setCLandmark] = useState("");

  const [customerRole, setCustomerRole] = useState<CustomerRole>("CLIENT");
  const [commercialName, setCommercialName] = useState("");
  const [customerIce, setCustomerIce] = useState("");

  // ✅ Commercial responsable de la vente (optionnel) — distinct de
  // "Nom commercial"/commercialName ci-dessus (nom d'entreprise d'un
  // client VENDEUR), sans rapport avec l'attribution des ventes à un
  // commercial (rôle COMMERCIAL, commissions).
  const [commercials, setCommercials] = useState<AdminCommercialProfile[]>([]);
  const [commercialId, setCommercialId] = useState<number | null>(null);

  const [basket, setBasket] = useState<{ product: Product; qty: number }[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [markDone, setMarkDone] = useState(true);

  const [discountType, setDiscountType] = useState<AdminDiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountLabel, setDiscountLabel] = useState<string>("");

  const [payMethod, setPayMethod] = useState<PosPaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"ALL" | "PROMO" | "NO_PROMO">("ALL");
  const [sortBy, setSortBy] = useState<"NAME" | "PRICE_ASC" | "PRICE_DESC">("NAME");

  const [includeHidden, setIncludeHidden] = useState(false);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const searchAbort = useRef<AbortController | null>(null);

  const [saving, setSaving] = useState(false);

  const basketItemsTotal = useMemo(() => {
    return basket.reduce((s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0), 0);
  }, [basket]);

  const adminDiscountAmount = useMemo(() => {
    return computeAdminDiscountAmount(basketItemsTotal, discountType, discountValue);
  }, [basketItemsTotal, discountType, discountValue]);

  const discountedItemsTotal = useMemo(() => {
    return Math.max(0, clampMoney(basketItemsTotal - adminDiscountAmount));
  }, [basketItemsTotal, adminDiscountAmount]);

  const basketTotal = useMemo(() => {
    return discountedItemsTotal;
  }, [discountedItemsTotal]);

  const paidClamped = useMemo(() => {
    const t = Math.max(0, numSafe(basketTotal));
    const p = Math.max(0, Math.min(numSafe(amountPaid), t));
    return p;
  }, [basketTotal, amountPaid]);

  const remaining = useMemo(() => computeRemaining(basketTotal, paidClamped), [basketTotal, paidClamped]);
  const payStatus = useMemo(() => computePayStatus(basketTotal, paidClamped), [basketTotal, paidClamped]);

  useEffect(() => {
    if (paidClamped !== amountPaid) setAmountPaid(paidClamped);
  }, [paidClamped, amountPaid]);

  const reset = useCallback(() => {
    setSearch("");
    setPromoFilter("ALL");
    setSortBy("NAME");
    setIncludeHidden(false);

    setSearchErr(null);
    setSearchLoading(false);
    setResults([]);

    setBasket([]);
    setAmountPaid(0);

    setDiscountType("NONE");
    setDiscountValue(0);
    setDiscountLabel("");

    setPayMethod("CASH");
    setPaymentReference("");

    setCFirst("");
    setCLast("");
    setCPhone("");

    setCCity("");
    setCCommune("");
    setCDistrict("");
    setCAddress("");
    setCLandmark("");

    setCustomerRole("CLIENT");
    setCommercialName("");
    setCustomerIce("");
    setCommercialId(null);

    setMarkDone(true);
    setSaving(false);
  }, []);

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
      prev
        .map((x) => (x.product.id === pId ? { ...x, qty: Math.max(1, qty) } : x))
        .filter((x) => x.qty > 0)
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
    setDiscountType("NONE");
    setDiscountValue(0);
    setDiscountLabel("");
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
        const res = await listProducts({
          page,
          pageSize: pageSizeAll,
          onlyActive: includeHidden ? false : true,
        } as any);

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

      const merged = Array.from(map.values());
      const finalList = includeHidden ? merged : merged.filter((p) => isProductActive(p));
      setResults(finalList);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setSearchErr(e?.message || "Impossible de charger les produits.");
    } finally {
      if (!ac.signal.aborted) setSearchLoading(false);
    }
  }, [open, includeHidden]);

  const loadCommercials = useCallback(async () => {
    if (!open) return;
    try {
      const res = await listCommercialProfiles();
      setCommercials(res.items || []);
    } catch {
      setCommercials([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadAllProducts();
    loadCommercials();
    return () => {
      searchAbort.current?.abort();
    };
  }, [open, loadAllProducts, loadCommercials]);

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
    if (sortBy === "NAME") {
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
    } else if (sortBy === "PRICE_ASC") {
      sorted.sort((a, b) => getProductUnitPrice(a) - getProductUnitPrice(b));
    } else if (sortBy === "PRICE_DESC") {
      sorted.sort((a, b) => getProductUnitPrice(b) - getProductUnitPrice(a));
    }
    return sorted;
  }, [results, search, promoFilter, sortBy]);

  async function submitCreate() {
    if (basket.length === 0) {
      alert("Ajoutez au moins un produit.");
      return;
    }

    if (!cCity || cCity.trim() === "") {
      alert("La ville du client est obligatoire.");
      return;
    }

    if (discountType !== "NONE" && discountValue <= 0) {
      alert("Entre une valeur de réduction valide.");
      return;
    }

    if (cPhone.trim() && !isValidPhoneIntl(cPhone)) {
      alert("Le numéro de téléphone n'est pas valide (format international, ex: +212...).");
      return;
    }

    const role = normalizeCustomerRole(customerRole);

    if (role === "VENDEUR") {
      if (!commercialName.trim()) {
        alert("Le nom commercial est obligatoire pour un client vendeur.");
        return;
      }
      if (!customerIce.trim()) {
        alert("L'ICE est obligatoire pour un client vendeur.");
        return;
      }
    }

    const total = Math.max(0, numSafe(basketTotal));
    const paid = paidClamped;
    const remain = computeRemaining(total, paid);
    const status = computePayStatus(total, paid);

    const normalizedPhone = cPhone.trim() ? normalizePhone(cPhone) : null;
    const paymentMethodLabel = getPaymentMethodLabel(payMethod);
    const paymentMethodNormalized = normalizePaymentMethod(payMethod);

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
      customer_role: role,
      commercial_id: commercialId,

      contact: {
        first_name: cFirst || "Client",
        last_name: cLast || "POS",
        phone: normalizedPhone,
        city: cCity || null,
        commune: cCommune || null,
        district: cDistrict || null,
        address_line: cAddress || null,
        landmark: cLandmark || null,
        role,
        commercial_name: role === "VENDEUR" ? commercialName.trim() : null,
        ice: role === "VENDEUR" ? customerIce.trim() : null,
      },

      address: {
        city: cCity || null,
        ville: cCity || null,
        commune: cCommune || null,
        district: cDistrict || null,
        quartier: cDistrict || null,
        address_line: cAddress || null,
        landmark: cLandmark || null,
        gps: null,
      },

      delivery: {
        mode: "SIMPLE" as const,
        fee: 0,
        currency: "MAD" as const,
      },

      items: itemsPayload,

      totals: {
        items_count: itemsPayload.reduce((s, it) => s + (Number(it.qty) || 0), 0),
        items_amount: Math.max(0, numSafe(basketItemsTotal)),
        delivery_fee: 0,
        amount: total,
        currency: "MAD",
      },

      payment: {
        method: paymentMethodNormalized,
        method_label: paymentMethodLabel,
        reference: paymentReference.trim() || null,
        note:
          `Vente sur place | ${paymentMethodLabel} | ${status} | payé=${paid} | reste=${remain}` +
          (paymentReference.trim() ? ` | ref=${paymentReference.trim()}` : ""),
        paid_amount: paid,
        status,
      },

      admin_discount:
        discountType === "NONE"
          ? { type: "NONE" as const }
          : {
              type: discountType,
              value: Math.max(0, numSafe(discountValue)),
              label: discountLabel.trim() || "Réduction POS",
            },
    };

    try {
      setSaving(true);
      const created = await createAdminOrder(payload as any);

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
            <div className="d-flex flex-column">
              <h5 className="modal-title mb-0">Vente sur place</h5>
              <div className="text-muted small">Commande “sur place” (livraison = 0)</div>
            </div>
            <button className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body pos-body">
            <div className="row g-3 pos-grid">
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

                      <div className="col-12">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="posIncludeHidden"
                            checked={includeHidden}
                            onChange={(e) => setIncludeHidden(e.target.checked)}
                            disabled={saving}
                          />
                          <label className="form-check-label" htmlFor="posIncludeHidden">
                            Inclure les <strong>produits cachés</strong> (inactifs)
                          </label>
                        </div>
                      </div>
                    </div>

                    {searchErr && <div className="alert alert-danger mt-2 mb-0">{searchErr}</div>}

                    <div className="mt-2 pos-scroll">
                      {searchLoading ? (
                        <LoadingState label="Chargement de tous les produits…" />
                      ) : (
                        <div className="vstack gap-2">
                          {filteredResults.map((p) => {
                            const unit = getProductUnitPrice(p);
                            const promo = hasPromo(p);
                            const base = Number((p as AnyObj)?.price ?? unit);
                            const active = isProductActive(p);

                            return (
                              <div
                                key={p.id}
                                className="d-flex justify-content-between align-items-center border rounded p-2"
                              >
                                <div className="text-truncate" style={{ maxWidth: 460 }}>
                                  <div className="fw-semibold text-truncate d-flex align-items-center gap-2">
                                    <span className="text-truncate">{p.name}</span>
                                    {!active ? <span className="badge bg-dark">Caché</span> : null}
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
                        <span className="text-muted">Sous-total produits</span>
                        <span className="fw-semibold">{mad(basketItemsTotal)}</span>
                      </div>

                      {discountType !== "NONE" && (
                        <>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted">
                              Réduction {discountType === "PERCENT" ? `(${discountValue || 0}%)` : ""}
                            </span>
                            <span className="fw-semibold text-danger">- {mad(adminDiscountAmount)}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted">Total net</span>
                            <span className="fw-semibold">{mad(discountedItemsTotal)}</span>
                          </div>
                        </>
                      )}

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
                                  onChange={(e) => setQty(ln.product.id, Math.max(1, Number(e.target.value || 1)))}
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

                    <div className="row g-2">
                      <div className="col-12 col-md-4">
                        <h6 className="mb-2">Type réduction</h6>
                        <select
                          className="form-select"
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as AdminDiscountType)}
                          disabled={saving}
                        >
                          <option value="NONE">Aucune</option>
                          <option value="AMOUNT">Montant</option>
                          <option value="PERCENT">Pourcentage</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-4">
                        <h6 className="mb-2">Valeur</h6>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control"
                          value={toInputNumberValue(discountValue)}
                          onChange={(e) => setDiscountValue(fromInputNumberValue(e.target.value))}
                          disabled={saving || discountType === "NONE"}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <h6 className="mb-2">Libellé</h6>
                        <input
                          className="form-control"
                          placeholder="Ex: Remise POS"
                          value={discountLabel}
                          onChange={(e) => setDiscountLabel(e.target.value)}
                          disabled={saving || discountType === "NONE"}
                        />
                      </div>
                    </div>

                    <div className="small text-muted mt-1">
                      La réduction admin s’applique sur les produits uniquement.
                    </div>

                    <hr className="my-3" />

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <h6 className="mb-2">Méthode paiement</h6>
                        <select
                          className="form-select"
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as PosPaymentMethod)}
                          disabled={saving}
                        >
                          <option value="BMCE">BMCE</option>
                          <option value="GAZHALA">GAZHALA</option>
                          <option value="CASH">CASH</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
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
                      </div>

                      <div className="col-12">
                        <h6 className="mb-2">Référence paiement</h6>
                        <input
                          className="form-control"
                          placeholder="Ex: N° transaction, référence dépôt..."
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <hr className="my-3" />

                    <h6 className="mb-2">Client</h6>
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
                          placeholder="Téléphone (+212...)"
                          value={cPhone}
                          onChange={(e) => setCPhone(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Ville *"
                          value={cCity}
                          onChange={(e) => setCCity(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Commune"
                          value={cCommune}
                          onChange={(e) => setCCommune(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Quartier"
                          value={cDistrict}
                          onChange={(e) => setCDistrict(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-sm-6">
                        <input
                          className="form-control"
                          placeholder="Adresse"
                          value={cAddress}
                          onChange={(e) => setCAddress(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12">
                        <input
                          className="form-control"
                          placeholder="Repère"
                          value={cLandmark}
                          onChange={(e) => setCLandmark(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-sm-4">
                        <select
                          className="form-select"
                          value={customerRole}
                          onChange={(e) => setCustomerRole(normalizeCustomerRole(e.target.value))}
                          disabled={saving}
                        >
                          <option value="CLIENT">Client</option>
                          <option value="VENDEUR">Vendeur</option>
                        </select>
                      </div>

                      {customerRole === "VENDEUR" ? (
                        <>
                          <div className="col-12 col-sm-4">
                            <input
                              className="form-control"
                              placeholder="Nom commercial *"
                              value={commercialName}
                              onChange={(e) => setCommercialName(e.target.value)}
                              disabled={saving}
                            />
                          </div>

                          <div className="col-12 col-sm-4">
                            <input
                              className="form-control"
                              placeholder="ICE *"
                              value={customerIce}
                              onChange={(e) => setCustomerIce(e.target.value)}
                              disabled={saving}
                            />
                          </div>
                        </>
                      ) : null}

                      <div className="col-12 col-sm-4">
                        <select
                          className="form-select"
                          value={commercialId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCommercialId(v ? Number(v) : null);
                          }}
                          disabled={saving}
                        >
                          <option value="">Commercial : aucun / vente directe</option>
                          {commercials.map((c) => (
                            <option key={c.user_id} value={c.user_id}>
                              {`${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="small text-muted mt-2">
                      Si le téléphone correspond à un compte existant, le backend mettra à jour ce compte avec le rôle
                      choisi. Si tu choisis <strong>VENDEUR</strong>, le nom commercial et l’ICE sont obligatoires.
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
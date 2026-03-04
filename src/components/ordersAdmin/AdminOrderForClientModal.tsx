// src/components/ordersAdmin/AdminOrderForClientModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProducts, type Product, isProductActive } from "../../services/products";
import {
  createAdminOrder,
  updateOrderStatus,
  type OrderStatus,
  type PaymentStatus,
} from "../../services/orders";
import { API_BASE } from "../../services/http";
import { listAllAdminUsers, type AdminUser } from "../../services/adminUsers";

type AnyObj = Record<string, any>;

type ClientLite = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;

  // ✅ affichage/UX
  has_account?: boolean; // true si user existe (id>0)
  from_orders?: boolean; // true si vient des orders (guest)
};

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

function imgUrl(u?: string | null) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("http")) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return s;
}

/** ✅ essaie de sortir une image produit (cover / images[0] / media...) */
function getProductThumb(p: Product): string {
  const anyP = p as AnyObj;

  const candidates = [
    anyP.cover,
    anyP.cover_url,
    anyP.coverUrl,
    anyP.image,
    anyP.image_url,
    anyP.imageUrl,
    anyP.photo,
    anyP.photo_url,
    anyP.photoUrl,
    anyP.thumbnail,
    anyP.thumb,
    anyP.thumb_url,
    anyP.thumbUrl,
    Array.isArray(anyP.images) ? anyP.images?.[0]?.url : null,
    Array.isArray(anyP.images) ? anyP.images?.[0]?.secure_url : null,
    Array.isArray(anyP.media) ? anyP.media?.[0]?.url : null,
    Array.isArray(anyP.media) ? anyP.media?.[0]?.secure_url : null,
  ];

  const raw = candidates.find((x) => typeof x === "string" && String(x).trim());
  return imgUrl(raw || "");
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
  if (Number.isFinite(promoNum) && promoNum > 0 && promoNum < Number(base || Infinity))
    return promoNum;

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

function clientLabel(c: ClientLite) {
  const name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  const phone = (c.phone || "").trim();
  if (name && phone) return `${name} — ${phone}`;
  if (name) return name;
  if (phone) return phone;
  return c.from_orders ? `Client (orders)` : `Client #${c.id}`;
}

function normalizePhoneKey(phone?: string | null) {
  return String(phone || "").trim().replace(/\s+/g, "");
}

/**
 * ✅ dé-doublonnage robuste:
 * - users: id>0
 * - guests (orders): id=0/NULL mais phone présent
 * - clé principale: phone si présent, sinon id
 * - priorité: USER > GUEST
 */
function dedupeClients(list: ClientLite[]) {
  const byKey = new Map<string, ClientLite>();

  for (const c of list) {
    const id = Number(c.id || 0);
    const phone = normalizePhoneKey(c.phone);

    const key = phone ? `P:${phone}` : id > 0 ? `U:${id}` : `X:${Math.random()}`;

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, c);
      continue;
    }

    const prevIsUser = Number(prev.id || 0) > 0;
    const curIsUser = id > 0;

    // priorité user
    const keep = prevIsUser || !curIsUser ? prev : c;
    const other = keep === prev ? c : prev;

    byKey.set(key, {
      id: Number(keep.id || 0),
      first_name: keep.first_name || other.first_name || null,
      last_name: keep.last_name || other.last_name || null,
      phone: keep.phone || other.phone || null,
      role: keep.role || other.role || null,
      has_account: keep.has_account ?? other.has_account,
      from_orders: keep.from_orders ?? other.from_orders,
    });
  }

  return Array.from(byKey.values());
}

function pickName(u: any) {
  const first = u?.first_name ?? u?.firstName ?? null;
  const last = u?.last_name ?? u?.lastName ?? null;
  return {
    first_name: first ? String(first).trim() : null,
    last_name: last ? String(last).trim() : null,
  };
}

function mapAdminUserToClient(u: AdminUser): ClientLite {
  const anyU = u as any;
  const names = pickName(anyU);

  const idNum = Number(anyU?.id || 0);
  const hasAccount = anyU?.has_account != null ? !!anyU.has_account : idNum > 0;

  return {
    id: idNum > 0 ? idNum : 0, // guests => 0
    first_name: names.first_name,
    last_name: names.last_name,
    phone: anyU?.phone ?? anyU?.tel ?? null,
    role: anyU?.role ?? (hasAccount ? "MEMBER" : "GUEST"),
    has_account: hasAccount,
    from_orders: anyU?.from_orders != null ? !!anyU.from_orders : !hasAccount,
  };
}

export default function AdminOrderForClientModal({ open, onClose, onCreated }: Props) {
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);

  const [basket, setBasket] = useState<{ product: Product; qty: number }[]>([]);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [payNote, setPayNote] = useState<string>("");
  const [markDone, setMarkDone] = useState(true);

  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryMode, setDeliveryMode] = useState<
    "SIMPLE" | "EXPRESS" | "CITY" | "CASABLANCA" | "PROMO_FREE"
  >("SIMPLE");

  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"ALL" | "PROMO" | "NO_PROMO">("ALL");
  const [sortBy, setSortBy] = useState<"NAME" | "PRICE_ASC" | "PRICE_DESC">("NAME");
  const [includeHidden, setIncludeHidden] = useState(false);

  const [prodLoading, setProdLoading] = useState(false);
  const [prodErr, setProdErr] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const prodAbort = useRef<AbortController | null>(null);

  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErr, setClientsErr] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientQ, setClientQ] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const basketItemsTotal = useMemo(() => {
    return basket.reduce((s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0), 0);
  }, [basket]);

  const basketTotal = useMemo(() => {
    return Math.max(0, numSafe(basketItemsTotal)) + Math.max(0, numSafe(deliveryFee));
  }, [basketItemsTotal, deliveryFee]);

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
    setSelectedClient(null);
    setClientQ("");

    setBasket([]);
    setAmountPaid(0);
    setPayMethod("CASH");
    setPayNote("");
    setMarkDone(true);

    setDeliveryFee(0);
    setDeliveryMode("SIMPLE");

    setSearch("");
    setPromoFilter("ALL");
    setSortBy("NAME");
    setIncludeHidden(false);

    setProdErr(null);
    setProdLoading(false);
    setProducts([]);

    setClientsErr(null);
    setClientsLoading(false);
    setClients([]);

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
  }

  const loadAllProducts = useCallback(async () => {
    if (!open) return;

    prodAbort.current?.abort();
    const ac = new AbortController();
    prodAbort.current = ac;

    setProdLoading(true);
    setProdErr(null);

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
      setProducts(finalList);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setProdErr(e?.message || "Impossible de charger les produits.");
    } finally {
      if (!ac.signal.aborted) setProdLoading(false);
    }
  }, [open, includeHidden]);

  const loadClients = useCallback(async () => {
    if (!open) return;

    setClientsLoading(true);
    setClientsErr(null);

    try {
      const all = await listAllAdminUsers({
        pageSize: 2000,
        include_orders: true,
      } as any);

      const mapped = (all || []).map(mapAdminUserToClient);
      const merged = dedupeClients(mapped);

      merged.sort((a, b) => clientLabel(a).localeCompare(clientLabel(b), "fr"));
      setClients(merged);
    } catch (e: any) {
      setClientsErr(e?.message || "Impossible de charger les clients.");
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    loadAllProducts();
    loadClients();

    return () => {
      prodAbort.current?.abort();
    };
  }, [open, loadAllProducts, loadClients]);

  const filteredProducts = useMemo(() => {
    const ql = search.trim().toLowerCase();
    let arr = products;

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
    if (sortBy === "NAME")
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
    else if (sortBy === "PRICE_ASC")
      sorted.sort((a, b) => getProductUnitPrice(a) - getProductUnitPrice(b));
    else if (sortBy === "PRICE_DESC")
      sorted.sort((a, b) => getProductUnitPrice(b) - getProductUnitPrice(a));
    return sorted;
  }, [products, search, promoFilter, sortBy]);

  const filteredClients = useMemo(() => {
    const ql = clientQ.trim().toLowerCase();
    if (!ql) return clients;

    return clients.filter((c) => {
      const label = clientLabel(c).toLowerCase();
      const phone = normalizePhoneKey(c.phone).toLowerCase();
      return label.includes(ql) || phone.includes(ql) || (c.id > 0 && String(c.id).includes(ql));
    });
  }, [clients, clientQ]);

  function isSameClient(a: ClientLite | null, b: ClientLite) {
    if (!a) return false;
    const aPhone = normalizePhoneKey(a.phone);
    const bPhone = normalizePhoneKey(b.phone);
    if (aPhone && bPhone) return aPhone === bPhone;
    if (a.id > 0 && b.id > 0) return a.id === b.id;
    return false;
  }

  async function submitCreate() {
    if (!selectedClient) {
      alert("Choisis un client.");
      return;
    }
    if (basket.length === 0) {
      alert("Ajoutez au moins un produit.");
      return;
    }

    const isGuest = !selectedClient.has_account || Number(selectedClient.id || 0) <= 0;
    if (isGuest) {
      const ph = normalizePhoneKey(selectedClient.phone);
      if (!ph) {
        alert("Téléphone requis pour un client sans compte.");
        return;
      }
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

    const payload: any = {
      ...(isGuest
        ? {
            contact: {
              phone: normalizePhoneKey(selectedClient.phone),
              first_name: selectedClient.first_name || undefined,
              last_name: selectedClient.last_name || undefined,
            },
          }
        : { customer_id: Number(selectedClient.id) }),

      delivery: {
        mode: deliveryMode,
        fee: Math.max(0, numSafe(deliveryFee)),
        currency: "MAD",
      },
      items: itemsPayload,
      totals: {
        items_count: itemsPayload.reduce((s, it) => s + (Number(it.qty) || 0), 0),
        items_amount: Math.max(0, numSafe(basketItemsTotal)),
        delivery_fee: Math.max(0, numSafe(deliveryFee)),
        amount: total,
        currency: "MAD",
      },
      payment: {
        method: payMethod,
        note: payNote || `Admin order | ${status} | payé=${paid} | reste=${remain}`,
        paid_amount: paid,
        status,
      },
    };

    try {
      setSaving(true);
      const created = await createAdminOrder(payload);

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
              <h5 className="modal-title mb-0">Commander pour un client</h5>
              <div className="text-muted small">
                Choisis le client, ajoute les produits, puis crée la commande
              </div>
            </div>
            <button className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body pos-body">
            <div className="row g-3 pos-grid">
              {/* Produits */}
              <div className="col-12 col-lg-7 pos-col">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div>
                        <h6 className="mb-0">Produits</h6>
                        <div className="text-muted small">Ajoute des produits au panier</div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-dark"
                        onClick={loadAllProducts}
                        disabled={prodLoading || saving}
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
                            id="adminIncludeHidden"
                            checked={includeHidden}
                            onChange={(e) => setIncludeHidden(e.target.checked)}
                            disabled={saving}
                          />
                          <label className="form-check-label" htmlFor="adminIncludeHidden">
                            Inclure les <strong>produits cachés</strong> (inactifs)
                          </label>
                        </div>
                      </div>
                    </div>

                    {prodErr && <div className="alert alert-danger mt-2 mb-0">{prodErr}</div>}

                    <div className="mt-2 pos-scroll">
                      {prodLoading ? (
                        <div className="text-muted">Chargement de tous les produits…</div>
                      ) : (
                        <div className="vstack gap-2">
                          {filteredProducts.map((p) => {
                            const unit = getProductUnitPrice(p);
                            const promo = hasPromo(p);
                            const base = Number((p as AnyObj)?.price ?? unit);
                            const active = isProductActive(p);
                            const thumb = getProductThumb(p);

                            return (
                              <div
                                key={p.id}
                                className="d-flex justify-content-between align-items-center border rounded p-2 gap-2"
                              >
                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={String(p.name || "Produit")}
                                      className="prod-thumb"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="prod-thumb prod-thumb--ph" aria-hidden="true" />
                                  )}

                                  <div className="text-truncate" style={{ maxWidth: 520 }}>
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
                                </div>

                                <button className="btn btn-sm btn-duu" onClick={() => addToBasket(p)} disabled={saving}>
                                  Ajouter
                                </button>
                              </div>
                            );
                          })}

                          {filteredProducts.length === 0 && (
                            <div className="text-muted small">Aucun produit.</div>
                          )}
                        </div>
                      )}

                      <div className="small text-muted mt-2">{products.length} produits chargés</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client + panier */}
              <div className="col-12 col-lg-5 pos-col">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <h6 className="mb-0">Client, Panier & Paiement</h6>
                        <div className="text-muted small">Sélection client obligatoire</div>
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={clearBasket} disabled={!basket.length || saving}>
                        Vider
                      </button>
                    </div>

                    {/* Clients */}
                    <div className="mt-2">
                      <div className="d-flex align-items-center justify-content-between">
                        <label className="form-label m-0">Client</label>
                        <button className="btn btn-sm btn-outline-dark" onClick={loadClients} disabled={clientsLoading || saving}>
                          Rafraîchir
                        </button>
                      </div>

                      <input
                        className="form-control form-control-sm mt-2"
                        placeholder="Rechercher client (nom, téléphone, id)…"
                        value={clientQ}
                        onChange={(e) => setClientQ(e.target.value)}
                        disabled={saving}
                      />

                      {clientsErr && <div className="alert alert-danger mt-2 mb-0">{clientsErr}</div>}

                      <div className="client-list mt-2" aria-label="Liste des clients">
                        {clientsLoading ? (
                          <div className="text-muted small p-2">Chargement clients…</div>
                        ) : filteredClients.length === 0 ? (
                          <div className="text-muted small p-2">Aucun client</div>
                        ) : (
                          filteredClients.map((c, idx) => {
                            const selected = isSameClient(selectedClient, c);
                            const disabled = saving;

                            return (
                              <button
                                key={`${c.id || 0}-${normalizePhoneKey(c.phone) || idx}`}
                                type="button"
                                className={`client-item ${selected ? "client-item--active" : ""}`}
                                onClick={() => {
                                  if (!disabled) setSelectedClient(c);
                                }}
                                disabled={disabled}
                                title={clientLabel(c)}
                              >
                                <div className="client-name text-truncate">{clientLabel(c)}</div>
                                <div className="client-sub small text-muted">
                                  {c.has_account ? `ID: ${c.id}` : "Invité (sans compte)"}
                                  {c.from_orders ? " • orders" : ""}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="small text-muted mt-2">
                        {clientsLoading ? "Chargement…" : `${filteredClients.length}/${clients.length} client(s)`}
                      </div>
                    </div>

                    {/* Totaux */}
                    <div className="pos-summary mt-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Articles</span>
                        <span className="fw-semibold">{mad(basketItemsTotal)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Livraison</span>
                        <span className="fw-semibold">{mad(deliveryFee)}</span>
                      </div>
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

                    {/* Panier */}
                    <div className="vstack gap-2 mt-3 pos-scroll">
                      {basket.length === 0 ? (
                        <div className="text-muted small">Aucun article.</div>
                      ) : (
                        basket.map((ln) => {
                          const unit = getProductUnitPrice(ln.product);
                          const promo = hasPromo(ln.product);
                          const base = Number((ln.product as AnyObj)?.price ?? unit);
                          const thumb = getProductThumb(ln.product);

                          return (
                            <div
                              key={ln.product.id}
                              className="d-flex align-items-center justify-content-between border rounded p-2 gap-2"
                            >
                              <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={String(ln.product.name || "Produit")}
                                    className="prod-thumb prod-thumb--sm"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="prod-thumb prod-thumb--sm prod-thumb--ph" aria-hidden="true" />
                                )}

                                <div className="text-truncate" style={{ maxWidth: 240 }}>
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
                              </div>

                              <div className="d-flex align-items-center gap-2">
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  style={{ width: 80 }}
                                  min={1}
                                  value={ln.qty}
                                  onChange={(e) =>
                                    setQty(
                                      ln.product.id,
                                      Math.max(1, Number((e.target as HTMLInputElement).value || 1))
                                    )
                                  }
                                  disabled={saving}
                                />
                                <button className="btn btn-sm btn-outline-danger" onClick={() => removeLine(ln.product.id)} disabled={saving}>
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <hr className="my-3" />

                    {/* Livraison */}
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label">Mode livraison</label>
                        <select
                          className="form-select"
                          value={deliveryMode}
                          onChange={(e) => setDeliveryMode((e.target as HTMLSelectElement).value as any)}
                          disabled={saving}
                        >
                          <option value="SIMPLE">SIMPLE</option>
                          <option value="EXPRESS">EXPRESS</option>
                          <option value="CITY">CITY</option>
                          <option value="CASABLANCA">CASABLANCA</option>
                          <option value="PROMO_FREE">PROMO_FREE</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Frais livraison</label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control"
                          value={toInputNumberValue(deliveryFee)}
                          onChange={(e) => setDeliveryFee(fromInputNumberValue((e.target as HTMLInputElement).value))}
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <hr className="my-3" />

                    {/* Paiement */}
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label">Méthode paiement</label>
                        <select
                          className="form-select"
                          value={payMethod}
                          onChange={(e) => setPayMethod((e.target as HTMLSelectElement).value)}
                          disabled={saving}
                        >
                          <option value="CASH">CASH</option>
                          <option value="COD">COD</option>
                          <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                          <option value="VIREMENT">VIREMENT</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Montant payé</label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control"
                          value={toInputNumberValue(amountPaid)}
                          onChange={(e) => setAmountPaid(fromInputNumberValue((e.target as HTMLInputElement).value))}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Note (optionnel)</label>
                        <input
                          className="form-control"
                          value={payNote}
                          onChange={(e) => setPayNote((e.target as HTMLInputElement).value)}
                          disabled={saving}
                          placeholder="Ex: payé en boutique, virement en attente…"
                        />
                      </div>
                    </div>

                    <div className="form-check mt-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="markDoneAdmin"
                        checked={markDone}
                        onChange={(e) => setMarkDone((e.target as HTMLInputElement).checked)}
                        disabled={saving}
                      />
                      <label className="form-check-label" htmlFor="markDoneAdmin">
                        Marquer comme <strong>livrée (DONE)</strong> après création
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              {/* /Client + panier */}
            </div>
          </div>

          <div className="modal-footer pos-sticky-footer">
            <button className="btn btn-outline-dark" onClick={onClose} disabled={saving}>
              Fermer
            </button>
            <button
              className="btn btn-dark"
              onClick={submitCreate}
              disabled={saving || basket.length === 0 || !selectedClient}
            >
              {saving ? "Enregistrement…" : "Créer la commande"}
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

            .prod-thumb{
              width: 46px;
              height: 46px;
              border-radius: 10px;
              object-fit: cover;
              border: 1px solid rgba(0,0,0,.08);
              flex: 0 0 auto;
              background: #f6f6f6;
            }
            .prod-thumb--sm{
              width: 36px;
              height: 36px;
              border-radius: 10px;
            }
            .prod-thumb--ph{
              background: linear-gradient(135deg, rgba(0,0,0,.05), rgba(0,0,0,.02));
            }

            /* ✅ Liste clients scrollable */
            .client-list{
              max-height: 220px;
              overflow-y: auto;
              border: 1px solid rgba(0,0,0,.08);
              border-radius: 10px;
              margin-top: 8px;
              background: #fff;
            }
            .client-item{
              width: 100%;
              border: none;
              background: transparent;
              text-align: left;
              padding: 8px 10px;
              border-bottom: 1px solid rgba(0,0,0,.05);
              cursor: pointer;
            }
            .client-item:last-child{ border-bottom: none; }
            .client-item:hover{ background: rgba(0,0,0,.04); }
            .client-item--active{
              background: var(--duu-yellow);
              font-weight: 600;
            }
            .client-name{ font-size: 14px; }
            .client-sub{ font-size: 12px; }

            .client-item:disabled{
              opacity: .55;
              cursor: not-allowed;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listProducts,
  type Product,
  isProductActive,
} from "../../services/products";
import {
  createAdminOrder,
  updateOrderStatus,
  type AdminDiscountType,
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
  ville?: string | null;
  quartier?: string | null;
  commercial_name?: string | null;
  ice?: string | null;
  has_account?: boolean;
  from_orders?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

const CITY_OPTIONS = [
  "Casablanca",
  "Marrakech",
  "Rabat",
  "Tanger",
  "Fès",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "El Jadida",
  "Mohammédia",
  "Béni Mellal",
  "Nador",
  "Khouribga",
  "Settat",
  "Temara",
  "Salé",
  "Autre",
];

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

function clampMoney(n: number) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return +x.toFixed(2);
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
  if (
    Number.isFinite(promoNum) &&
    promoNum > 0 &&
    promoNum < Number(base || Infinity)
  ) {
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

function clientLabel(c: ClientLite) {
  const name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  const phone = (c.phone || "").trim();
  if (name && phone) return `${name} — ${phone}`;
  if (name) return name;
  if (phone) return phone;
  return c.from_orders ? `Client (orders)` : `Client #${c.id}`;
}

function normalizePhoneKey(phone?: string | null) {
  return String(phone || "")
    .trim()
    .replace(/\s+/g, "");
}

function normalizeCustomerRole(value?: string | null): "CLIENT" | "VENDEUR" {
  return String(value || "")
    .trim()
    .toUpperCase() === "VENDEUR"
    ? "VENDEUR"
    : "CLIENT";
}

function dedupeClients(list: ClientLite[]) {
  const byKey = new Map<string, ClientLite>();

  for (const c of list) {
    const id = Number(c.id || 0);
    const phone = normalizePhoneKey(c.phone);
    const key = phone
      ? `P:${phone}`
      : id > 0
        ? `U:${id}`
        : `X:${Math.random()}`;

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, c);
      continue;
    }

    const prevIsUser = Number(prev.id || 0) > 0;
    const curIsUser = id > 0;

    const keep = prevIsUser || !curIsUser ? prev : c;
    const other = keep === prev ? c : prev;

    byKey.set(key, {
      id: Number(keep.id || 0),
      first_name: keep.first_name || other.first_name || null,
      last_name: keep.last_name || other.last_name || null,
      phone: keep.phone || other.phone || null,
      role: keep.role || other.role || null,
      ville: keep.ville || other.ville || null,
      quartier: keep.quartier || other.quartier || null,
      commercial_name: keep.commercial_name || other.commercial_name || null,
      ice: keep.ice || other.ice || null,
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
    id: idNum > 0 ? idNum : 0,
    first_name: names.first_name,
    last_name: names.last_name,
    phone: anyU?.phone ?? anyU?.tel ?? null,
    role: anyU?.role ?? (hasAccount ? "CLIENT" : "GUEST"),
    ville: anyU?.ville ?? anyU?.city ?? anyU?.customer_city ?? null,
    quartier:
      anyU?.quartier ?? anyU?.district ?? anyU?.customer_district ?? null,
    commercial_name: anyU?.commercial_name ?? anyU?.nom_commercial ?? null,
    ice: anyU?.ice ?? null,
    has_account: hasAccount,
    from_orders: anyU?.from_orders != null ? !!anyU.from_orders : !hasAccount,
  };
}

function computeAdminDiscountAmount(
  itemsSubtotal: number,
  discountType: AdminDiscountType,
  discountValue: number,
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

function needsVendorIdentity(
  role: "CLIENT" | "VENDEUR",
  commercialName: string,
  ice: string,
) {
  if (role !== "VENDEUR") return false;
  return !commercialName.trim() || !ice.trim();
}

export default function AdminOrderForClientModal({
  open,
  onClose,
  onCreated,
}: Props) {
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

  const [discountType, setDiscountType] = useState<AdminDiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountLabel, setDiscountLabel] = useState<string>("");

  const [clientCity, setClientCity] = useState<string>("");
  const [clientDistrict, setClientDistrict] = useState<string>("");

  const [clientRole, setClientRole] = useState<"CLIENT" | "VENDEUR">("CLIENT");
  const [vendorCommercialName, setVendorCommercialName] = useState<string>("");
  const [vendorIce, setVendorIce] = useState<string>("");

  const [vendorInfoModalOpen, setVendorInfoModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"ALL" | "PROMO" | "NO_PROMO">(
    "ALL",
  );
  const [sortBy, setSortBy] = useState<"NAME" | "PRICE_ASC" | "PRICE_DESC">(
    "NAME",
  );
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
    return basket.reduce(
      (s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0),
      0,
    );
  }, [basket]);

  const adminDiscountAmount = useMemo(() => {
    return computeAdminDiscountAmount(
      basketItemsTotal,
      discountType,
      discountValue,
    );
  }, [basketItemsTotal, discountType, discountValue]);

  const discountedItemsTotal = useMemo(() => {
    return Math.max(0, clampMoney(basketItemsTotal - adminDiscountAmount));
  }, [basketItemsTotal, adminDiscountAmount]);

  const basketTotal = useMemo(() => {
    return (
      Math.max(0, numSafe(discountedItemsTotal)) +
      Math.max(0, numSafe(deliveryFee))
    );
  }, [discountedItemsTotal, deliveryFee]);

  const paidClamped = useMemo(() => {
    const t = Math.max(0, numSafe(basketTotal));
    const p = Math.max(0, Math.min(numSafe(amountPaid), t));
    return p;
  }, [basketTotal, amountPaid]);

  const remaining = useMemo(
    () => computeRemaining(basketTotal, paidClamped),
    [basketTotal, paidClamped],
  );

  useEffect(() => {
    if (paidClamped !== amountPaid) setAmountPaid(paidClamped);
  }, [paidClamped, amountPaid]);

  useEffect(() => {
    if (!selectedClient) {
      setClientCity("");
      setClientDistrict("");
      setClientRole("CLIENT");
      setVendorCommercialName("");
      setVendorIce("");
      return;
    }

    setClientCity(String(selectedClient.ville || "").trim());
    setClientDistrict(String(selectedClient.quartier || "").trim());

    const nextRole = normalizeCustomerRole(selectedClient.role);
    setClientRole(nextRole);
    setVendorCommercialName(
      String(selectedClient.commercial_name || "").trim(),
    );
    setVendorIce(String(selectedClient.ice || "").trim());
  }, [selectedClient]);

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

    setDiscountType("NONE");
    setDiscountValue(0);
    setDiscountLabel("");

    setClientCity("");
    setClientDistrict("");
    setClientRole("CLIENT");
    setVendorCommercialName("");
    setVendorIce("");
    setVendorInfoModalOpen(false);

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
        .map((x) =>
          x.product.id === pId ? { ...x, qty: Math.max(1, qty) } : x,
        )
        .filter((x) => x.qty > 0),
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

      const finalList = includeHidden
        ? merged
        : merged.filter((p) => isProductActive(p));
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
        const sku = String(
          anyP.sku || anyP.ref || anyP.code || "",
        ).toLowerCase();
        return name.includes(ql) || (sku && sku.includes(ql));
      });
    }

    const sorted = [...arr];
    if (sortBy === "NAME") {
      sorted.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "fr"),
      );
    } else if (sortBy === "PRICE_ASC") {
      sorted.sort((a, b) => getProductUnitPrice(a) - getProductUnitPrice(b));
    } else if (sortBy === "PRICE_DESC") {
      sorted.sort((a, b) => getProductUnitPrice(b) - getProductUnitPrice(a));
    }
    return sorted;
  }, [products, search, promoFilter, sortBy]);

  const filteredClients = useMemo(() => {
    const ql = clientQ.trim().toLowerCase();
    if (!ql) return clients;

    return clients.filter((c) => {
      const label = clientLabel(c).toLowerCase();
      const phone = normalizePhoneKey(c.phone).toLowerCase();
      const ville = String(c.ville || "").toLowerCase();
      const quartier = String(c.quartier || "").toLowerCase();
      const commercialName = String(c.commercial_name || "").toLowerCase();
      const ice = String(c.ice || "").toLowerCase();

      return (
        label.includes(ql) ||
        phone.includes(ql) ||
        ville.includes(ql) ||
        quartier.includes(ql) ||
        commercialName.includes(ql) ||
        ice.includes(ql) ||
        (c.id > 0 && String(c.id).includes(ql))
      );
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

  async function doCreateOrder() {
    if (!selectedClient) {
      alert("Choisis un client.");
      return;
    }
    if (basket.length === 0) {
      alert("Ajoutez au moins un produit.");
      return;
    }

    const city = String(clientCity || "").trim();
    const district = String(clientDistrict || "").trim();

    if (!city) {
      alert("Choisis la ville du client.");
      return;
    }

    const isGuest =
      !selectedClient.has_account || Number(selectedClient.id || 0) <= 0;
    if (isGuest) {
      const ph = normalizePhoneKey(selectedClient.phone);
      if (!ph) {
        alert("Téléphone requis pour un client sans compte.");
        return;
      }
    }

    if (discountType !== "NONE" && discountValue <= 0) {
      alert("Entre une valeur de réduction valide.");
      return;
    }

    if (clientRole === "VENDEUR" && !vendorCommercialName.trim()) {
      alert("Le nom commercial du vendeur est obligatoire.");
      return;
    }

    if (clientRole === "VENDEUR" && !vendorIce.trim()) {
      alert("L'ICE du vendeur est obligatoire.");
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

    const clientLocation = {
      ville: city,
      city,
      quartier: district || undefined,
      district: district || undefined,
    };

    const payload: any = {
      ...(isGuest
        ? {
            contact: {
              phone: normalizePhoneKey(selectedClient.phone),
              first_name: selectedClient.first_name || undefined,
              last_name: selectedClient.last_name || undefined,
              role: clientRole,
              commercial_name:
                clientRole === "VENDEUR"
                  ? vendorCommercialName.trim()
                  : undefined,
              ice: clientRole === "VENDEUR" ? vendorIce.trim() : undefined,
            },
          }
        : {
            customer_id: Number(selectedClient.id),
            customer: {
              first_name: selectedClient.first_name || undefined,
              last_name: selectedClient.last_name || undefined,
              phone: normalizePhoneKey(selectedClient.phone) || undefined,
              role: clientRole,
              commercial_name:
                clientRole === "VENDEUR"
                  ? vendorCommercialName.trim()
                  : undefined,
              ice: clientRole === "VENDEUR" ? vendorIce.trim() : undefined,
              ...clientLocation,
            },
          }),

      address: {
        ...clientLocation,
        commune: undefined,
        address_line: undefined,
      },

      delivery: {
        mode: deliveryMode,
        fee: Math.max(0, numSafe(deliveryFee)),
        currency: "MAD",
      },

      items: itemsPayload,

      totals: {
        items_count: itemsPayload.reduce(
          (s, it) => s + (Number(it.qty) || 0),
          0,
        ),
        items_amount: Math.max(0, numSafe(basketItemsTotal)),
        delivery_fee: Math.max(0, numSafe(deliveryFee)),
        amount: total,
        currency: "MAD",
      },

      payment: {
        method: payMethod,
        note:
          payNote || `Admin order | ${status} | payé=${paid} | reste=${remain}`,
        paid_amount: paid,
        status,
      },

      admin_discount:
        discountType === "NONE"
          ? { type: "NONE" }
          : {
              type: discountType,
              value: Math.max(0, numSafe(discountValue)),
              label: discountLabel.trim() || undefined,
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

  function submitCreate() {
    if (!selectedClient) {
      alert("Choisis un client.");
      return;
    }

    const missingVendorData = needsVendorIdentity(
      clientRole,
      vendorCommercialName,
      vendorIce,
    );

    const existingDbClient =
      !!selectedClient.has_account && Number(selectedClient.id || 0) > 0;

    if (existingDbClient && clientRole === "VENDEUR" && missingVendorData) {
      setVendorInfoModalOpen(true);
      return;
    }

    void doCreateOrder();
  }

  if (!open) return null;

  return (
    <>
      <div
        className="modal d-block duu-admin-order-backdrop"
        tabIndex={-1}
        role="dialog"
      >
        <div
          className="modal-dialog modal-xl duu-admin-order-dialog"
          role="document"
        >
          <div className="modal-content duu-admin-order-modal">
            <div className="modal-header duu-admin-order-header">
              <div className="d-flex flex-column">
                <h5 className="modal-title mb-0">Commander pour un client</h5>
                <div className="text-muted small">
                  Sélectionne le client, ajoute les produits, puis valide la
                  commande
                </div>
              </div>

              <button
                className="btn-close"
                onClick={onClose}
                disabled={saving}
              />
            </div>

            <div className="modal-body duu-admin-order-body">
              <div className="row g-3">
                <div className="col-12 col-xl-7">
                  <div className="duu-panel h-100">
                    <div className="duu-panel-head">
                      <div>
                        <div className="duu-section-title">Produits</div>
                        <div className="duu-section-subtitle">
                          Ajoute rapidement les articles au panier
                        </div>
                      </div>

                      <button
                        className="btn btn-sm btn-outline-dark"
                        onClick={loadAllProducts}
                        disabled={prodLoading || saving}
                      >
                        Rafraîchir
                      </button>
                    </div>

                    <div className="row g-2 mt-1">
                      <div className="col-12 col-md-6">
                        <input
                          className="form-control duu-input"
                          placeholder="Rechercher (nom, sku)…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12 col-md-3">
                        <select
                          className="form-select duu-input"
                          value={promoFilter}
                          onChange={(e) =>
                            setPromoFilter(e.target.value as any)
                          }
                          disabled={saving}
                        >
                          <option value="ALL">Tous</option>
                          <option value="PROMO">Promos</option>
                          <option value="NO_PROMO">Sans promo</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-3">
                        <select
                          className="form-select duu-input"
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
                        <label className="duu-check">
                          <input
                            type="checkbox"
                            checked={includeHidden}
                            onChange={(e) => setIncludeHidden(e.target.checked)}
                            disabled={saving}
                          />
                          <span>
                            Inclure les <strong>produits cachés</strong>{" "}
                            (inactifs)
                          </span>
                        </label>
                      </div>
                    </div>

                    {prodErr && (
                      <div className="alert alert-danger mt-3 mb-0">
                        {prodErr}
                      </div>
                    )}

                    <div className="duu-products-list mt-3">
                      {prodLoading ? (
                        <div className="text-muted small">
                          Chargement de tous les produits…
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="text-muted small">Aucun produit.</div>
                      ) : (
                        filteredProducts.map((p) => {
                          const unit = getProductUnitPrice(p);
                          const promo = hasPromo(p);
                          const base = Number((p as AnyObj)?.price ?? unit);
                          const active = isProductActive(p);
                          const thumb = getProductThumb(p);

                          return (
                            <div key={p.id} className="duu-product-card">
                              <div className="duu-product-card-left">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={String(p.name || "Produit")}
                                    className="duu-product-thumb"
                                    loading="lazy"
                                    onError={(e) => {
                                      (
                                        e.currentTarget as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="duu-product-thumb duu-product-thumb--ph" />
                                )}

                                <div className="min-w-0">
                                  <div className="duu-product-name-row">
                                    <div className="duu-product-name">
                                      {p.name}
                                    </div>
                                    {!active ? (
                                      <span className="badge bg-dark">
                                        Caché
                                      </span>
                                    ) : null}
                                    {promo ? (
                                      <span className="badge bg-danger">
                                        Promo
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="duu-product-price">
                                    {promo ? (
                                      <>
                                        <span className="text-decoration-line-through me-2 text-muted">
                                          {mad(base)}
                                        </span>
                                        <span className="fw-bold">
                                          {mad(unit)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="fw-bold">
                                        {mad(unit)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                className="btn btn-sm duu-btn-yellow"
                                onClick={() => addToBasket(p)}
                                disabled={saving}
                              >
                                Ajouter
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="small text-muted mt-2">
                      {products.length} produits chargés
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-5">
                  <div className="duu-panel h-100">
                    <div className="duu-panel-head">
                      <div>
                        <div className="duu-section-title">
                          Client, panier & paiement
                        </div>
                        <div className="duu-section-subtitle">
                          Finalisation rapide
                        </div>
                      </div>

                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={clearBasket}
                        disabled={!basket.length || saving}
                      >
                        Vider
                      </button>
                    </div>

                    <div className="duu-block mt-2">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <label className="form-label m-0 fw-semibold">
                          Client
                        </label>
                        <button
                          className="btn btn-sm btn-outline-dark"
                          onClick={loadClients}
                          disabled={clientsLoading || saving}
                        >
                          Rafraîchir
                        </button>
                      </div>

                      <input
                        className="form-control duu-input"
                        placeholder="Rechercher client (nom, téléphone, ville, quartier, id)…"
                        value={clientQ}
                        onChange={(e) => setClientQ(e.target.value)}
                        disabled={saving}
                      />

                      {clientsErr && (
                        <div className="alert alert-danger mt-2 mb-0">
                          {clientsErr}
                        </div>
                      )}

                      <div className="duu-clients-list mt-2">
                        {clientsLoading ? (
                          <div className="text-muted small p-2">
                            Chargement clients…
                          </div>
                        ) : filteredClients.length === 0 ? (
                          <div className="text-muted small p-2">
                            Aucun client
                          </div>
                        ) : (
                          filteredClients.map((c, idx) => {
                            const selected = isSameClient(selectedClient, c);

                            return (
                              <button
                                key={`${c.id || 0}-${normalizePhoneKey(c.phone) || idx}`}
                                type="button"
                                className={`duu-client-item ${selected ? "duu-client-item--active" : ""}`}
                                onClick={() => {
                                  if (!saving) setSelectedClient(c);
                                }}
                                disabled={saving}
                                title={clientLabel(c)}
                              >
                                <div className="duu-client-main">
                                  {clientLabel(c)}
                                </div>
                                <div className="duu-client-meta">
                                  {c.has_account
                                    ? `ID: ${c.id}`
                                    : "Invité (sans compte)"}
                                  {c.ville ? ` • ${c.ville}` : ""}
                                  {c.quartier ? ` • ${c.quartier}` : ""}
                                  {c.role ? ` • ${c.role}` : ""}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="row g-2 mt-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">
                          Ville du client
                        </label>
                        <select
                          className="form-select duu-input"
                          value={clientCity}
                          onChange={(e) =>
                            setClientCity((e.target as HTMLSelectElement).value)
                          }
                          disabled={saving}
                        >
                          <option value="">Choisir une ville</option>
                          {CITY_OPTIONS.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">
                          Quartier
                        </label>
                        <input
                          className="form-control duu-input"
                          value={clientDistrict}
                          onChange={(e) =>
                            setClientDistrict(
                              (e.target as HTMLInputElement).value,
                            )
                          }
                          disabled={saving}
                          placeholder="Ex: Maarif, Gueliz…"
                        />
                      </div>
                    </div>

                    <div className="row g-2 mt-2">
                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">
                          Rôle du client
                        </label>
                        <select
                          className="form-select duu-input"
                          value={clientRole}
                          onChange={(e) =>
                            setClientRole(
                              (e.target as HTMLSelectElement).value as
                                | "CLIENT"
                                | "VENDEUR",
                            )
                          }
                          disabled={saving}
                        >
                          <option value="CLIENT">Client simple</option>
                          <option value="VENDEUR">Vendeur</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">
                          Nom commercial
                        </label>
                        <input
                          className="form-control duu-input"
                          value={vendorCommercialName}
                          onChange={(e) =>
                            setVendorCommercialName(e.target.value)
                          }
                          disabled={saving || clientRole !== "VENDEUR"}
                          placeholder="Ex: Roky Marrakech"
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">ICE</label>
                        <input
                          className="form-control duu-input"
                          value={vendorIce}
                          onChange={(e) => setVendorIce(e.target.value)}
                          disabled={saving || clientRole !== "VENDEUR"}
                          placeholder="Ex: 003492191000081"
                        />
                      </div>
                    </div>

                    <div className="small text-muted mt-1">
                      Si le rôle est vendeur, le nom commercial et l’ICE sont
                      obligatoires.
                    </div>

                    <div className="duu-summary-card mt-3">
                      <div className="duu-summary-row">
                        <span>Articles</span>
                        <strong>{mad(basketItemsTotal)}</strong>
                      </div>

                      {discountType !== "NONE" && (
                        <>
                          <div className="duu-summary-row">
                            <span>
                              Réduction{" "}
                              {discountType === "PERCENT"
                                ? `(${discountValue || 0}%)`
                                : ""}
                            </span>
                            <strong className="text-danger">
                              - {mad(adminDiscountAmount)}
                            </strong>
                          </div>
                          <div className="duu-summary-row">
                            <span>Sous-total net</span>
                            <strong>{mad(discountedItemsTotal)}</strong>
                          </div>
                        </>
                      )}

                      <div className="duu-summary-row">
                        <span>Livraison</span>
                        <strong>{mad(deliveryFee)}</strong>
                      </div>
                      <div className="duu-summary-row">
                        <span>Total</span>
                        <strong>{mad(basketTotal)}</strong>
                      </div>
                      <div className="duu-summary-row">
                        <span>Payé</span>
                        <strong>{mad(paidClamped)}</strong>
                      </div>
                      <div className="duu-summary-row">
                        <span>Reste</span>
                        <strong>{mad(remaining)}</strong>
                      </div>
                    </div>

                    <div className="duu-basket-list mt-3">
                      {basket.length === 0 ? (
                        <div className="text-muted small">Aucun article.</div>
                      ) : (
                        basket.map((ln) => {
                          const unit = getProductUnitPrice(ln.product);
                          const thumb = getProductThumb(ln.product);

                          return (
                            <div
                              key={ln.product.id}
                              className="duu-basket-item"
                            >
                              <div className="duu-basket-item-left">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={String(ln.product.name || "Produit")}
                                    className="duu-product-thumb duu-product-thumb--sm"
                                  />
                                ) : (
                                  <div className="duu-product-thumb duu-product-thumb--sm duu-product-thumb--ph" />
                                )}

                                <div className="min-w-0">
                                  <div className="duu-product-name">
                                    {ln.product.name}
                                  </div>
                                  <div className="duu-product-price small fw-bold">
                                    {mad(unit)}
                                  </div>
                                </div>
                              </div>

                              <div className="d-flex align-items-center gap-2">
                                <input
                                  type="number"
                                  className="form-control form-control-sm duu-qty-input"
                                  min={1}
                                  value={ln.qty}
                                  onChange={(e) =>
                                    setQty(
                                      ln.product.id,
                                      Math.max(
                                        1,
                                        Number(
                                          (e.target as HTMLInputElement)
                                            .value || 1,
                                        ),
                                      ),
                                    )
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

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">
                          Mode livraison
                        </label>
                        <select
                          className="form-select duu-input"
                          value={deliveryMode}
                          onChange={(e) =>
                            setDeliveryMode(
                              (e.target as HTMLSelectElement).value as any,
                            )
                          }
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
                        <label className="form-label fw-semibold">
                          Frais livraison
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control duu-input"
                          value={toInputNumberValue(deliveryFee)}
                          onChange={(e) =>
                            setDeliveryFee(
                              fromInputNumberValue(
                                (e.target as HTMLInputElement).value,
                              ),
                            )
                          }
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <hr className="my-3" />

                    <div className="row g-2">
                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">
                          Type réduction
                        </label>
                        <select
                          className="form-select duu-input"
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(
                              (e.target as HTMLSelectElement)
                                .value as AdminDiscountType,
                            )
                          }
                          disabled={saving}
                        >
                          <option value="NONE">Aucune</option>
                          <option value="AMOUNT">Montant</option>
                          <option value="PERCENT">Pourcentage</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">
                          Valeur {discountType === "PERCENT" ? "(%)" : "(MAD)"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control duu-input"
                          value={toInputNumberValue(discountValue)}
                          onChange={(e) =>
                            setDiscountValue(
                              fromInputNumberValue(
                                (e.target as HTMLInputElement).value,
                              ),
                            )
                          }
                          disabled={saving || discountType === "NONE"}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label fw-semibold">
                          Libellé réduction
                        </label>
                        <input
                          className="form-control duu-input"
                          value={discountLabel}
                          onChange={(e) =>
                            setDiscountLabel(
                              (e.target as HTMLInputElement).value,
                            )
                          }
                          disabled={saving || discountType === "NONE"}
                          placeholder="Ex: Geste commercial"
                        />
                      </div>
                    </div>

                    <hr className="my-3" />

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">
                          Méthode paiement
                        </label>
                        <select
                          className="form-select duu-input"
                          value={payMethod}
                          onChange={(e) =>
                            setPayMethod((e.target as HTMLSelectElement).value)
                          }
                          disabled={saving}
                        >
                          <option value="CASH">CASH</option>
                          <option value="COD">COD</option>
                          <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                          <option value="VIREMENT">VIREMENT</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">
                          Montant payé
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control duu-input"
                          value={toInputNumberValue(amountPaid)}
                          onChange={(e) =>
                            setAmountPaid(
                              fromInputNumberValue(
                                (e.target as HTMLInputElement).value,
                              ),
                            )
                          }
                          disabled={saving}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-semibold">Note</label>
                        <input
                          className="form-control duu-input"
                          value={payNote}
                          onChange={(e) =>
                            setPayNote((e.target as HTMLInputElement).value)
                          }
                          disabled={saving}
                          placeholder="Ex: payé en boutique, virement en attente…"
                        />
                      </div>
                    </div>

                    <label className="duu-check mt-3">
                      <input
                        type="checkbox"
                        checked={markDone}
                        onChange={(e) => setMarkDone(e.target.checked)}
                        disabled={saving}
                      />
                      <span>
                        Marquer comme <strong>livrée (DONE)</strong> après
                        création
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer duu-admin-order-footer">
              <button
                className="btn btn-outline-dark"
                onClick={onClose}
                disabled={saving}
              >
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
          </div>
        </div>
      </div>

      {vendorInfoModalOpen && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          style={{ background: "rgba(0,0,0,.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content" style={{ borderRadius: 18 }}>
              <div className="modal-header">
                <h5 className="modal-title">Informations vendeur requises</h5>
                <button
                  className="btn-close"
                  onClick={() => setVendorInfoModalOpen(false)}
                  disabled={saving}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Ce client existe déjà dans la base, mais il manque les
                  informations vendeur. Merci de renseigner le nom commercial et
                  l’ICE avant de continuer.
                </p>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Nom commercial
                  </label>
                  <input
                    className="form-control"
                    value={vendorCommercialName}
                    onChange={(e) => setVendorCommercialName(e.target.value)}
                    disabled={saving}
                    placeholder="Ex: Roky Marrakech"
                  />
                </div>

                <div>
                  <label className="form-label fw-semibold">ICE</label>
                  <input
                    className="form-control"
                    value={vendorIce}
                    onChange={(e) => setVendorIce(e.target.value)}
                    disabled={saving}
                    placeholder="Ex: 003492191000081"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setVendorInfoModalOpen(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  className="btn btn-dark"
                  disabled={saving}
                  onClick={async () => {
                    if (!vendorCommercialName.trim()) {
                      alert("Le nom commercial est obligatoire.");
                      return;
                    }
                    if (!vendorIce.trim()) {
                      alert("L'ICE est obligatoire.");
                      return;
                    }
                    setVendorInfoModalOpen(false);
                    await doCreateOrder();
                  }}
                >
                  Continuer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .duu-admin-order-backdrop{
          background: rgba(15, 15, 15, .45);
          backdrop-filter: blur(2px);
        }

        .duu-admin-order-dialog{
          max-width: 1380px;
        }

        .duu-admin-order-modal{
          border: none;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,.18);
          max-height: calc(100vh - 2rem);
          display: flex;
          flex-direction: column;
          background: #f6f7f9;
        }

        .duu-admin-order-header{
          background: #fff;
          border-bottom: 1px solid rgba(0,0,0,.06);
          padding: 18px 22px;
        }

        .duu-admin-order-body{
          overflow: auto;
          flex: 1 1 auto;
          padding: 18px;
        }

        .duu-admin-order-footer{
          background: #fff;
          border-top: 1px solid rgba(0,0,0,.06);
          padding: 14px 22px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .duu-panel{
          background: #fff;
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 10px 28px rgba(17,17,17,.04);
        }

        .duu-panel-head{
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .duu-section-title{
          font-size: 1.1rem;
          font-weight: 800;
          color: #1f2937;
        }

        .duu-section-subtitle{
          font-size: .9rem;
          color: #6b7280;
        }

        .duu-input{
          border-radius: 12px;
          min-height: 44px;
        }

        .duu-check{
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .duu-products-list{
          max-height: 62vh;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .duu-product-card{
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 16px;
          padding: 12px;
          background: #fff;
        }

        .duu-product-card-left{
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1 1 auto;
        }

        .duu-product-thumb{
          width: 72px;
          height: 72px;
          border-radius: 14px;
          object-fit: cover;
          background: linear-gradient(180deg, #fff7bf 0%, #ffe45c 100%);
          border: 1px solid rgba(0,0,0,.06);
        }

        .duu-product-thumb--sm{
          width: 56px;
          height: 56px;
          border-radius: 12px;
        }

        .duu-product-name{
          font-weight: 700;
          color: #1f2937;
        }

        .duu-product-name-row{
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .duu-product-price{
          color: #4b5563;
          margin-top: 4px;
          font-size: .93rem;
        }

        .duu-btn-yellow{
          background: #ffd000;
          color: #111827;
          border: none;
          border-radius: 12px;
          padding: 9px 14px;
          font-weight: 700;
        }

        .duu-block{
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 16px;
          background: #fafafa;
          padding: 12px;
        }

        .duu-clients-list{
          max-height: 250px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .duu-client-item{
          text-align: left;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 12px;
          background: #fff;
          padding: 10px 12px;
        }

        .duu-client-item--active{
          border-color: #ffd000;
          box-shadow: 0 0 0 3px rgba(255,208,0,.18);
        }

        .duu-client-main{
          font-weight: 700;
          color: #1f2937;
        }

        .duu-client-meta{
          font-size: .82rem;
          color: #6b7280;
          margin-top: 2px;
        }

        .duu-summary-card{
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 16px;
          padding: 12px;
          background: #fffdf0;
        }

        .duu-summary-row{
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
        }

        .duu-basket-list{
          max-height: 260px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .duu-basket-item{
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          padding: 10px;
          background: #fff;
        }

        .duu-basket-item-left{
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1 1 auto;
        }

        .duu-qty-input{
          width: 82px;
        }
      `}</style>
    </>
  );
}

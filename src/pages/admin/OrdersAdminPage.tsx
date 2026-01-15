import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  createOrder,
  type Order,
  type OrderStatus,
} from "../../services/orders";
import { listProducts, type Product } from "../../services/products";
import { Link } from "react-router-dom";
import { subscribeSSE, type ServerEvent } from "../../services/events";
import { API_BASE } from "../../services/http";

const STATUSES: OrderStatus[] = ["OPEN", "PREPARATION", "DELIVERY", "DONE", "CANCELLED"];

const BADGE: Record<OrderStatus, string> = {
  OPEN: "bg-secondary",
  PREPARATION: "bg-warning",
  DELIVERY: "bg-info",
  DONE: "bg-success",
  CANCELLED: "bg-danger",
};

type AnyObj = Record<string, any>;

/* ===== Helpers image ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

/** Image de produit robuste (utilise product_cover renvoyé par GET /api/orders/:id) */
function getItemImage(it: AnyObj): string {
  const raw =
    it.product_cover ||
    it.image_url ||
    it.cover ||
    it.product_image ||
    it.image ||
    it.thumb ||
    it.thumbnail ||
    (it.product &&
      (it.product.product_cover ||
        it.product.image_url ||
        it.product.cover ||
        it.product.image ||
        it.product.thumb)) ||
    null;

  return imgUrl(raw || "");
}

/** Vignette pour la ligne de tableau (liste des commandes) */
function getOrderThumb(o: AnyObj): string {
  return imgUrl(o.first_product_cover || o.product_cover || "");
}

/* ===== Helpers téléphone / WhatsApp ===== */
function normalizePhoneTel(phone?: string, defaultCountry = "+212") {
  const raw = (phone || "").replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (/^0\d{9,}$/.test(raw)) return defaultCountry + raw.slice(1);
  return raw;
}
function telHref(phone?: string) {
  const normalized = normalizePhoneTel(phone);
  return normalized ? `tel:${normalized}` : undefined;
}

/** wa.me attend uniquement des chiffres (pas +, pas espaces) */
function waDigits(phone?: string, fallback = "212623677884") {
  const normalized = normalizePhoneTel(phone) || "";
  const digits = normalized.replace(/[^\d]/g, "");
  return digits || fallback;
}

/** lien partage produit (peut générer un aperçu image si OG tags ok) */
function productShareUrl(it: AnyObj) {
  const pid = it?.product_id ?? it?.productId ?? it?.id ?? null;
  if (!pid) return "";
  return `https://www.duumini.com/share/product/${pid}`;
}

/* ====== Petit util prix ====== */
const mad = (n?: number | null) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(Number(n || 0));

/* ===== Helper: code alphanumérique pour affichage ===== */
function getOrderDisplayCode(orderOrId: string | number | { id?: string | number }): string {
  let rawId: string | number | undefined;

  if (typeof orderOrId === "number" || typeof orderOrId === "string") rawId = orderOrId;
  else rawId = orderOrId?.id;

  if (rawId == null) return "";

  const num = typeof rawId === "number" ? rawId : Number(rawId);
  if (Number.isFinite(num) && num > 0) return num.toString(36).toUpperCase();

  return String(rawId ?? "").toUpperCase();
}

/* ===== Montants alignés backend ===== */
function computeOrderAmounts(order: AnyObj) {
  const totals = order.totals || {};
  const hasTotals = typeof totals === "object" && totals !== null;

  const total =
    typeof order.total === "number"
      ? order.total
      : hasTotals && typeof totals.amount === "number"
      ? totals.amount
      : Number(order.total || 0) || 0;

  const deliveryFee =
    hasTotals && typeof totals.delivery_fee === "number" ? Number(totals.delivery_fee) : 0;

  const itemsAmount =
    hasTotals && typeof totals.items_amount === "number"
      ? Number(totals.items_amount)
      : Math.max(0, Number(total) - Number(deliveryFee));

  const duuShare =
    (hasTotals && typeof totals.duumini_amount === "number"
      ? Number(totals.duumini_amount)
      : hasTotals && typeof totals.commission === "number"
      ? Number(totals.commission)
      : 0) || 0;

  return { total, deliveryFee, itemsAmount, duuShare };
}

/* ===== Message WhatsApp (texte + liens produits) ===== */
function buildAdminWhatsappMessage(order: AnyObj) {
  const items: AnyObj[] = Array.isArray(order.items) ? order.items : [];
  const hasItems = items.length > 0;

  const created = order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "";

  const address = order.address || {};
  const contact = order.contact || order.user || {};
  const fullName =
    `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || contact.name || "cher(e) client(e)";

  const phone = contact.phone || order.phone || "";
  const displayCode = getOrderDisplayCode(order);

  const { itemsAmount, total, deliveryFee } = computeOrderAmounts(order);

  const ville = address.city || address.ville || order.address_city || "";
  const commune = address.commune || order.address_commune || "";
  const quartier = address.district || address.quartier || order.address_district || "";

  const status: OrderStatus | string = order.status || "OPEN";
  const statusText =
    status === "OPEN"
      ? "Nous avons bien reçu votre commande. Elle vient d’être prise en charge par notre équipe."
      : status === "PREPARATION"
      ? "Votre commande est en cours de préparation."
      : status === "DELIVERY"
      ? "Votre commande est en cours de livraison vers votre adresse."
      : status === "DONE"
      ? "Votre commande a été livrée. Nous espérons qu’elle vous plaira !"
      : status === "CANCELLED"
      ? "Votre commande a été annulée. N’hésitez pas à nous contacter pour plus d’informations."
      : "Voici un récapitulatif de votre commande.";

  const lines = hasItems
    ? items
        .map((it) => {
          const name = it.product_name || it.name || `Produit #${it.product_id ?? ""}`;
          const qty = Number(it.qty ?? 1);
          const unit = Number(it.unit_price ?? it.price ?? 0);
          const lineTotal = unit * qty;

          const link = productShareUrl(it);
          const linkPart = link ? `\n  🔗 ${link}` : "";

          return `• ${name} ×${qty} = ${mad(lineTotal)}${linkPart}`;
        })
        .join("\n")
    : "• Détails des articles indisponibles";

  const blocs: string[] = [];
  blocs.push(`Bonjour ${fullName},`);
  blocs.push("");
  blocs.push(`Merci pour votre commande chez *Duumini*`);
  blocs.push(statusText);
  blocs.push("");

  blocs.push(`*Détails de la commande #${displayCode}*`);
  if (created) blocs.push(`Date : ${created}`);
  blocs.push("");

  blocs.push("*Articles*");
  blocs.push(lines);
  blocs.push("");

  blocs.push(`Sous-total : ${mad(itemsAmount)}`);
  blocs.push(`Livraison : ${mad(deliveryFee)}`);
  blocs.push(`Total : ${mad(total)}`);
  blocs.push("");

  blocs.push("*Adresse de livraison*");
  if (ville) blocs.push(`Ville : ${ville}`);
  if (commune) blocs.push(`Commune : ${commune}`);
  if (quartier) blocs.push(`Quartier : ${quartier}`);
  blocs.push("");

  blocs.push(`Téléphone : ${phone || "—"}`);
  blocs.push("");
  blocs.push("Nous restons disponibles pour toute question.");
  blocs.push("Merci pour votre confiance.");

  return blocs.join("\n");
}

function waHref(order: AnyObj) {
  const recipient = waDigits(order.contact?.phone || order.user?.phone);
  const text = encodeURIComponent(buildAdminWhatsappMessage(order));
  return `https://wa.me/${recipient}?text=${text}`;
}

/* =========================
 * ✅ Vente sur place helpers
 * =======================*/

/** Détecte un prix promo / final price (multi-noms) */
function getProductUnitPrice(p: Product): number {
  const anyP = p as AnyObj;

  // Essaye plusieurs champs possibles (selon ton backend)
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

type PayStatus = "PAID" | "UNPAID" | "PARTIAL";

/* ===================== Page ===================== */
export default function OrdersAdminPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");

  // Edition statut
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  // Modale Voir
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [viewStatus, setViewStatus] = useState<OrderStatus>("OPEN");
  const [viewSaving, setViewSaving] = useState(false);

  // Vente sur place
  const [openCreate, setOpenCreate] = useState(false);
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [basket, setBasket] = useState<{ product: Product; qty: number }[]>([]);

  // ✅ filtres produits
  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"ALL" | "PROMO" | "NO_PROMO">("ALL");
  const [sortBy, setSortBy] = useState<"NAME" | "PRICE_ASC" | "PRICE_DESC">("NAME");

  // ✅ paiement sur place
  const [payStatus, setPayStatus] = useState<PayStatus>("UNPAID");
  const [amountPaid, setAmountPaid] = useState<number>(0);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [markDone, setMarkDone] = useState(true);
  const searchAbort = useRef<AbortController | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOrders({ page, pageSize });
      setItems(res.items);
      setTotal(res.pageInfo.total);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = subscribeSSE("/api/events/stream", (evt: ServerEvent) => {
      if (evt.type === "ORDER_CREATED" || evt.type === "ORDER_STATUS") {
        refresh();
        // @ts-ignore
        window?.duuminiToast?.({
          title: evt.payload?.title || (evt.type === "ORDER_CREATED" ? "Nouvelle commande" : "Commande mise à jour"),
          message: evt.payload?.body || "",
        });
      }
    });
    return () => sub.close();
  }, [refresh]);

  const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");

  const filtered = items.filter((o) => {
    if (!q.trim()) return true;
    const txt = q.toLowerCase();
    const contact = (o as any)?.contact || (o as any)?.user || {};
    const contactName = `${(contact?.first_name || "")} ${(contact?.last_name || "")}`.trim();
    return (
      String(o.id).includes(txt) ||
      (o.status?.toLowerCase() || "").includes(txt) ||
      contactName.toLowerCase().includes(txt) ||
      (contact?.phone || "").toLowerCase().includes(txt)
    );
  });

  const globalStats = useMemo(() => {
    let caNet = 0;
    let caDelivery = 0;
    let caDuumini = 0;

    items.forEach((o) => {
      const { itemsAmount, deliveryFee, duuShare } = computeOrderAmounts(o as AnyObj);
      caNet += itemsAmount;
      caDelivery += deliveryFee;
      caDuumini += duuShare;
    });

    return { caNet, caDelivery, caDuumini };
  }, [items]);

  async function onEdit(id: number) {
    try {
      const full = await getOrder(id);
      setEditId(full.id);
      setEditStatus(full.status);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onSave() {
    if (!editId) return;
    setSaving(true);
    try {
      await updateOrderStatus(editId, editStatus);
      setEditId(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(id: number) {
    if (!window.confirm("Annuler cette commande ?")) return;
    try {
      await cancelOrder(id);
      await refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onWhatsappClick(id: number) {
    try {
      const full = await getOrder(id);
      const url = waHref(full as AnyObj);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Impossible de préparer le message WhatsApp pour cette commande.");
    }
  }

  async function onView(id: number) {
    setViewId(id);
    setViewLoading(true);
    setViewErr(null);
    setDetail(null);
    try {
      const d = await getOrder(id);
      setDetail(d);
      setViewStatus(d?.status || "OPEN");
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewLoading(false);
    }
  }

  async function onViewSaveStatus() {
    if (!viewId) return;
    setViewSaving(true);
    try {
      await updateOrderStatus(viewId, viewStatus);
      await refresh();
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewSaving(false);
    }
  }

  const client = (() => {
    const d = detail || {};
    const c = d.contact || d.user || d;
    const first_name = c?.first_name ?? "";
    const last_name = c?.last_name ?? "";
    const phone = c?.phone ?? c?.user_phone ?? "";
    const fullName = `${(first_name || "").trim()} ${(last_name || "").trim()}`.trim() || "—";
    return { first_name, last_name, fullName, phone };
  })();

  const address = (detail?.address as AnyObj) || {};
  const itemsDetail: AnyObj[] = Array.isArray(detail?.items) ? detail!.items : [];

  const itemsAmount = itemsDetail.reduce(
    (sum, it) => sum + Number(it?.unit_price ?? it?.price ?? 0) * Number(it?.qty ?? 1),
    0
  );

  const totalAmount: number =
    typeof detail?.total === "number" ? detail!.total : Number((detail as any)?.totals?.amount ?? itemsAmount);

  const deliveryFee =
    (detail as any)?.totals?.delivery_fee ?? Math.max(0, Number(totalAmount) - Number(itemsAmount));

  // ✅ total panier basé sur le prix "unifié" (promo si dispo)
  const basketTotal = useMemo(() => {
    return basket.reduce((s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0), 0);
  }, [basket]);

  // ✅ reste à payer
  const remainingToPay = useMemo(() => {
    const paid = Number(amountPaid || 0);
    return Math.max(0, Number(basketTotal) - paid);
  }, [basketTotal, amountPaid]);

  // ✅ auto cohérence payStatus <-> amountPaid
  useEffect(() => {
    const total = Number(basketTotal || 0);
    const paid = Math.max(0, Math.min(Number(amountPaid || 0), total));

    // clamp
    if (paid !== amountPaid) setAmountPaid(paid);

    if (total <= 0) {
      if (payStatus !== "UNPAID") setPayStatus("UNPAID");
      return;
    }

    if (paid === 0 && payStatus !== "UNPAID") setPayStatus("UNPAID");
    else if (paid >= total && payStatus !== "PAID") setPayStatus("PAID");
    else if (paid > 0 && paid < total && payStatus !== "PARTIAL") setPayStatus("PARTIAL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketTotal]);

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
    setBasket((prev) => prev.map((x) => (x.product.id === pId ? { ...x, qty: Math.max(1, qty) } : x)));
  }

  function removeLine(pId: number) {
    setBasket((prev) => prev.filter((x) => x.product.id !== pId));
  }

  /** ✅ Charge TOUS les produits (pages) */
  const loadAllProducts = useCallback(async () => {
    if (!openCreate) return;

    searchAbort.current?.abort();
    const ac = new AbortController();
    searchAbort.current = ac;

    setSearchLoading(true);
    setSearchErr(null);

    try {
      const pageSizeAll = 100; // ajuste si besoin
      let page = 1;
      let all: Product[] = [];
      let totalExpected = Infinity;

      while (!ac.signal.aborted) {
        const res = await listProducts({ page, pageSize: pageSizeAll });
        if (ac.signal.aborted) return;

        const batch = (res.items || []) as Product[];
        all = all.concat(batch);

        const t = Number(res.pageInfo?.total ?? all.length);
        if (Number.isFinite(t)) totalExpected = t;

        if (all.length >= totalExpected) break;
        if (batch.length === 0) break;

        page += 1;
        // sécurité anti boucle infinie
        if (page > 200) break;
      }

      if (ac.signal.aborted) return;

      // Dé-dup au cas où
      const map = new Map<number, Product>();
      all.forEach((p) => map.set(p.id, p));
      setResults(Array.from(map.values()));
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setSearchErr(e?.message || "Impossible de charger les produits.");
    } finally {
      if (!ac.signal.aborted) setSearchLoading(false);
    }
  }, [openCreate]);

  useEffect(() => {
    if (openCreate) loadAllProducts();
  }, [openCreate, loadAllProducts]);

  // ✅ filtre + tri
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

    // ✅ clamp paiement
    const total = Number(basketTotal || 0);
    const paid = Math.max(0, Math.min(Number(amountPaid || 0), total));
    const remain = Math.max(0, total - paid);

    const itemsPayload = basket.map((b) => {
      const unit = getProductUnitPrice(b.product);
      return {
        product_id: b.product.id,
        name: b.product.name,
        price: Number(unit || 0),
        qty: b.qty,
        // info bonus (si backend stocke)
        meta: {
          base_price: Number((b.product as AnyObj)?.price ?? unit ?? 0),
          has_promo: hasPromo(b.product),
        },
      };
    });

    const payload = {
      contact: {
        first_name: cFirst || "",
        last_name: cLast || "",
        phone: cPhone || "",
      },
      address: { ville: "Casablanca", commune: "Sur place", quartier: "Boutique", gps: null },
      delivery: { mode: "SIMPLE" as const, fee: 0, currency: "MAD" as const },
      items: itemsPayload,
      totals: {
        items_count: itemsPayload.reduce((s, it) => s + it.qty, 0),
        items_amount: itemsPayload.reduce((s, it) => s + it.price * it.qty, 0),
        delivery_fee: 0,
        amount: total,
        currency: "MAD",
      },
      payment: {
        method: "CASH",
        // ✅ on garde une note lisible + champs structurés (si ton backend les conserve)
        note: `Vente sur place (boutique) | statut=${payStatus} | payé=${paid} | reste=${remain}`,
        status: payStatus,
        paid_amount: paid,
        remaining_amount: remain,
        currency: "MAD",
      },
    };

    try {
      setSaving(true);
      const created = await createOrder(payload as any);
      if (markDone && created?.id) await updateOrderStatus(created.id, "DONE");

      setOpenCreate(false);
      setBasket([]);
      setCFirst("");
      setCLast("");
      setCPhone("");
      setSearch("");
      setResults([]);

      // reset paiement
      setPayStatus("UNPAID");
      setAmountPaid(0);

      await refresh();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  }

  const editDisplayCode = editId !== null ? getOrderDisplayCode(editId) : "";
  const viewDisplayCode =
    viewId !== null ? (detail ? getOrderDisplayCode(detail as AnyObj) : getOrderDisplayCode(viewId)) : "";

  return (
    <div className="container-xxl py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h5 m-0">Commandes</h1>
        <div className="d-flex gap-2">
          <button
            className="btn btn-duu"
            onClick={() => {
              setOpenCreate(true);
            }}
          >
            + Vente sur place
          </button>
          <Link to="/admin" className="btn btn-outline-dark">
            Accueil admin
          </Link>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">CA (page) hors livraison</div>
              <div className="h6 m-0">{mad(globalStats.caNet)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Frais de livraison (page)</div>
              <div className="h6 m-0">{mad(globalStats.caDelivery)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">CA Duumini (page)</div>
              <div className="h6 m-0">{mad(globalStats.caDuumini)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <input
          className="form-control"
          placeholder="Recherche (#, statut, client, téléphone...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucune commande.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Image</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Statut</th>
                    <th className="text-end">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const c = (o as any)?.contact || (o as any)?.user || {};
                    const fn = (c?.first_name || "").trim();
                    const ln = (c?.last_name || "").trim();
                    const clientName = fn || ln ? `${fn} ${ln}`.trim() : "—";
                    const phone = (c?.phone || "").trim();
                    const hrefTel = telHref(phone);
                    const thumb = getOrderThumb(o as AnyObj);
                    const displayCode = getOrderDisplayCode(o);

                    const totalAligned = computeOrderAmounts(o as AnyObj).total;

                    return (
                      <tr key={o.id}>
                        <td>
                          <button
                            className="btn btn-link link-dark p-0"
                            onClick={() => onView(o.id)}
                            aria-label={`Voir commande #${displayCode}`}
                          >
                            {displayCode}
                          </button>
                        </td>

                        <td>
                          {thumb ? (
                            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "#f5f5f5" }}>
                              <img
                                src={thumb}
                                alt={`Produit commande #${displayCode}`}
                                className="w-100 h-100 object-fit-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>

                        <td>{dateTime(o.created_at)}</td>

                        <td className="text-truncate" style={{ maxWidth: 220 }}>
                          {clientName}
                        </td>

                        <td>
                          <div className="d-flex flex-column">
                            <small className="text-muted">{phone || "—"}</small>
                            <div className="d-flex gap-1 mt-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => onWhatsappClick(o.id)}
                                aria-label="WhatsApp"
                              >
                                WhatsApp
                              </button>
                              {hrefTel ? (
                                <a className="btn btn-sm btn-outline-dark" href={hrefTel} aria-label="Appeler">
                                  Appeler
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`badge ${BADGE[o.status]}`}>{o.status}</span>
                        </td>

                        <td className="text-end">{mad(totalAligned)}</td>

                        <td className="text-end">
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => onView(o.id)}>
                              Voir
                            </button>
                            <button className="btn btn-sm btn-outline-dark" onClick={() => onEdit(o.id)}>
                              Modifier
                            </button>
                            {o.status !== "CANCELLED" && o.status !== "DONE" && (
                              <button className="btn btn-sm btn-outline-danger" onClick={() => onCancel(o.id)}>
                                Annuler
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-2">
            <div className="text-muted small">{total} éléments</div>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-dark" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Préc.
              </button>
              <span className="btn btn-sm btn-outline-dark disabled">
                {page} / {pages}
              </span>
              <button className="btn btn-sm btn-outline-dark" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>

      {editId !== null && (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.2)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Commande #{editDisplayCode}</h5>
                <button className="btn-close" onClick={() => setEditId(null)} />
              </div>
              <div className="modal-body">
                <label className="form-label">Statut</label>
                <select
                  className="form-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  disabled={saving}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-dark" disabled={saving} onClick={() => setEditId(null)}>
                  Fermer
                </button>
                <button className="btn btn-dark" disabled={saving} onClick={onSave}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewId !== null && (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Commande #{viewDisplayCode}</h5>
                <button className="btn-close" onClick={() => setViewId(null)} />
              </div>

              <div className="modal-body">
                {viewLoading ? (
                  <div className="text-muted">Chargement…</div>
                ) : viewErr ? (
                  <div className="alert alert-danger">{viewErr}</div>
                ) : !detail ? (
                  <div className="text-muted">Aucun détail.</div>
                ) : (
                  <>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${BADGE[(detail.status as OrderStatus) || "OPEN"]}`}>{detail.status}</span>
                        <small className="text-muted">{dateTime(detail.created_at)}</small>
                      </div>
                      <div className="d-flex gap-2">
                        <select
                          className="form-select form-select-sm"
                          value={viewStatus}
                          onChange={(e) => setViewStatus(e.target.value as OrderStatus)}
                          style={{ width: 180 }}
                          disabled={viewSaving}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-dark" disabled={viewSaving} onClick={onViewSaveStatus}>
                          {viewSaving ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <h6 className="mb-2">Client</h6>
                        <div className="d-flex flex-wrap justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold">{client.fullName}</div>
                            <div className="text-muted small">{client.phone || "—"}</div>
                          </div>
                          <div className="d-flex gap-2">
                            <a className="btn btn-sm btn-success" href={waHref(detail as AnyObj)} target="_blank" rel="noopener noreferrer">
                              WhatsApp
                            </a>
                            {client.phone ? (
                              <a className="btn btn-sm btn-outline-dark" href={telHref(client.phone)}>
                                Appeler
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <h6 className="mb-2">Adresse de livraison</h6>
                        <div>
                          {address?.city || address?.ville || "—"}
                          {address?.commune ? `, ${address.commune}` : ""}
                          {address?.district || address?.quartier ? `, ${address.district ?? address.quartier}` : ""}
                          {address?.gps ? (
                            <>
                              <br />
                              <span className="text-muted small">
                                GPS: {address.gps.lat?.toFixed?.(5)}, {address.gps.lng?.toFixed?.(5)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        {detail?.geo_link ? (
                          <div className="mt-2">
                            <a className="btn btn-sm btn-outline-secondary" href={detail.geo_link} target="_blank" rel="noopener noreferrer">
                              Ouvrir dans Google Maps
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <h6 className="mb-2">Articles</h6>
                        <ul className="list-group list-group-flush">
                          {itemsDetail.map((it, i) => {
                            const name = it?.product_name || it?.name || `Produit #${it?.product_id ?? ""}`;
                            const qty = Number(it?.qty ?? 1);
                            const unit = Number(it?.unit_price ?? it?.price ?? 0);
                            const img = getItemImage(it);
                            const lineTotal = unit * qty;

                            return (
                              <li key={i} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                                <div className="d-flex align-items-center gap-2 flex-grow-1">
                                  {img ? (
                                    <div className="flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#f5f5f5" }}>
                                      <img src={img} alt={name} className="w-100 h-100 object-fit-cover" loading="lazy" />
                                    </div>
                                  ) : null}
                                  <div style={{ minWidth: 0 }}>
                                    <div className="fw-semibold text-truncate" title={name}>
                                      {name}
                                    </div>
                                    <div className="small text-muted">
                                      {mad(unit)} <span className="text-muted">×{qty}</span>
                                    </div>
                                  </div>
                                </div>
                                <span className="fw-semibold ms-2">{mad(lineTotal)}</span>
                              </li>
                            );
                          })}

                          {deliveryFee > 0 && (
                            <li className="list-group-item d-flex justify-content-between align-items-center">
                              <span className="text-muted">Livraison</span>
                              <span className="fw-semibold">{mad(deliveryFee)}</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="text-muted">Sous-total</div>
                          <div className="fw-semibold">{mad(itemsAmount)}</div>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="text-muted">Total</div>
                          <div className="h6 m-0">{mad(totalAmount)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={() => setViewId(null)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openCreate && (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nouvelle commande (sur place)</h5>
                <button className="btn-close" onClick={() => setOpenCreate(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <h6 className="mb-2">Ajouter des produits</h6>
                          <button className="btn btn-sm btn-outline-dark" onClick={loadAllProducts} disabled={searchLoading}>
                            Rafraîchir
                          </button>
                        </div>

                        <input
                          className="form-control mb-2"
                          placeholder="Rechercher un produit…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />

                        <div className="row g-2 mb-2">
                          <div className="col-12 col-md-6">
                            <select className="form-select" value={promoFilter} onChange={(e) => setPromoFilter(e.target.value as any)}>
                              <option value="ALL">Tous</option>
                              <option value="PROMO">Promotions</option>
                              <option value="NO_PROMO">Non promo</option>
                            </select>
                          </div>
                          <div className="col-12 col-md-6">
                            <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                              <option value="NAME">Tri : Nom</option>
                              <option value="PRICE_ASC">Tri : Prix ↑</option>
                              <option value="PRICE_DESC">Tri : Prix ↓</option>
                            </select>
                          </div>
                        </div>

                        {searchErr && <div className="alert alert-danger">{searchErr}</div>}
                        {searchLoading ? (
                          <div className="text-muted">Chargement de tous les produits…</div>
                        ) : (
                          <>
                            <div className="vstack gap-2" style={{ maxHeight: 520, overflow: "auto" }}>
                              {filteredResults.map((p) => {
                                const unit = getProductUnitPrice(p);
                                const promo = hasPromo(p);
                                const base = Number((p as AnyObj)?.price ?? unit);

                                return (
                                  <div key={p.id} className="d-flex justify-content-between align-items-center border rounded p-2">
                                    <div className="text-truncate" style={{ maxWidth: 260 }}>
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

                                    <button className="btn btn-sm btn-duu" onClick={() => addToBasket(p)}>
                                      Ajouter
                                    </button>
                                  </div>
                                );
                              })}

                              {filteredResults.length === 0 && <div className="text-muted small">Aucun produit.</div>}
                            </div>

                            <div className="small text-muted mt-2">{results.length} produits chargés</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body d-flex flex-column">
                        <h6 className="mb-2">Panier</h6>
                        <div className="vstack gap-2">
                          {basket.length === 0 ? (
                            <div className="text-muted small">Aucun article.</div>
                          ) : (
                            basket.map((ln) => {
                              const unit = getProductUnitPrice(ln.product);
                              const promo = hasPromo(ln.product);
                              const base = Number((ln.product as AnyObj)?.price ?? unit);

                              return (
                                <div key={ln.product.id} className="d-flex align-items-center justify-content-between border rounded p-2">
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
                                    />
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => removeLine(ln.product.id)}>
                                      Retirer
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <hr className="my-3" />

                        <h6 className="mb-2">Paiement</h6>
                        <div className="row g-2">
                          <div className="col-12 col-md-6">
                            <select
                              className="form-select"
                              value={payStatus}
                              onChange={(e) => {
                                const v = e.target.value as PayStatus;
                                setPayStatus(v);
                                if (v === "PAID") setAmountPaid(Number(basketTotal || 0));
                                if (v === "UNPAID") setAmountPaid(0);
                              }}
                            >
                              <option value="PAID">Payé</option>
                              <option value="UNPAID">Non payé</option>
                              <option value="PARTIAL">Partiel</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-6">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              className="form-control"
                              placeholder="Montant payé"
                              value={amountPaid}
                              onChange={(e) => setAmountPaid(Number(e.target.value || 0))}
                            />
                          </div>

                          <div className="col-12">
                            <div className="d-flex justify-content-between align-items-center border rounded p-2">
                              <div className="text-muted">Reste à payer</div>
                              <div className="fw-semibold">{mad(remainingToPay)}</div>
                            </div>
                          </div>
                        </div>

                        <hr className="my-3" />

                        <h6 className="mb-2">Client (facultatif)</h6>
                        <div className="row g-2">
                          <div className="col-12 col-sm-6">
                            <input className="form-control" placeholder="Prénom" value={cFirst} onChange={(e) => setCFirst(e.target.value)} />
                          </div>
                          <div className="col-12 col-sm-6">
                            <input className="form-control" placeholder="Nom" value={cLast} onChange={(e) => setCLast(e.target.value)} />
                          </div>
                          <div className="col-12">
                            <input className="form-control" placeholder="Téléphone (+212…)" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                          </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mt-3">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="markDone" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
                            <label className="form-check-label" htmlFor="markDone">
                              Marquer comme <strong>livrée (DONE)</strong> après création
                            </label>
                          </div>
                          <div className="h6 m-0">Total : {mad(basketTotal)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline-dark" onClick={() => setOpenCreate(false)} disabled={saving}>
                  Fermer
                </button>
                <button className="btn btn-dark" onClick={submitCreate} disabled={saving || basket.length === 0}>
                  {saving ? "Enregistrement…" : "Créer la commande"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-duu{
          background: var(--duu-yellow);
          color: #1f1f1f;
          border: none;
        }
        .btn-duu:hover{ filter: brightness(0.95); }
      `}</style>
    </div>
  );
}

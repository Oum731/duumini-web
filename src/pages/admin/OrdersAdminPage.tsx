// src/pages/admin/OrdersAdminPage.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  createOrder,
  updateOrderPayment, // ✅ si présent dans services/orders.ts
  type Order,
  type OrderStatus,
} from "../../services/orders";
import { listProducts, type Product } from "../../services/products";
import { Link } from "react-router-dom";
import { subscribeSSE, type ServerEvent } from "../../services/events";
import { API_BASE } from "../../services/http";
import { me } from "../../services/auth";

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
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

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

function numSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* =========================
 * ✅ Fulfillment (Delivery / Pickup / Expedition)
 * =======================*/
type Fulfillment = "DELIVERY" | "PICKUP" | "EXPEDITION";

function normFulfillment(o: AnyObj): Fulfillment {
  const delivery = o?.delivery && typeof o.delivery === "object" ? o.delivery : null;
  const modeRaw =
    String(
      delivery?.mode ??
        o?.delivery_mode ??
        o?.fulfillment ??
        o?.fulfillment_mode ??
        o?.shipping_mode ??
        "",
    )
      .trim()
      .toUpperCase() || "";

  if (modeRaw === "PICKUP") return "PICKUP";
  if (modeRaw === "EXPEDITION") return "EXPEDITION";

  if (modeRaw) return "DELIVERY";
  return "DELIVERY";
}

function fulfillmentLabel(f: Fulfillment) {
  if (f === "PICKUP") return { text: "RÉCUPÉRATION", cls: "bg-dark" };
  if (f === "EXPEDITION") return { text: "EXPÉDITION", cls: "bg-warning text-dark" };
  return { text: "LIVRAISON", cls: "bg-info" };
}

/* ====== Totaux/Commission ====== */
function computeOrderAmounts(order: AnyObj) {
  const totals = order?.totals || null;
  const hasTotals = totals && typeof totals === "object";
  const status = String(order?.status || "").toUpperCase();

  const total =
    typeof order?.total === "number"
      ? order.total
      : hasTotals && typeof totals.amount === "number"
        ? Number(totals.amount)
        : Number(order?.total || 0) || 0;

  const deliveryFee =
    hasTotals && typeof totals.delivery_fee === "number"
      ? Number(totals.delivery_fee)
      : Number(order?.delivery_fee || order?.deliveryFee || 0) || 0;

  let itemsAmount =
    hasTotals && typeof totals.items_amount === "number"
      ? Number(totals.items_amount)
      : typeof order?.items_amount === "number"
        ? Number(order.items_amount)
        : 0;

  if (!itemsAmount || itemsAmount <= 0) {
    const arr = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.order_items)
        ? order.order_items
        : [];
    if (arr.length) {
      itemsAmount = arr.reduce((s: number, it: AnyObj) => {
        const qty = Number(it?.qty ?? 1) || 1;
        const unit = Number(it?.unit_price ?? it?.price ?? it?.final_price ?? 0) || 0;
        return s + unit * qty;
      }, 0);
    } else {
      itemsAmount = Math.max(0, Number(total) - Number(deliveryFee));
    }
  }

  const direct =
    typeof order?.commission_duumini === "number"
      ? Number(order.commission_duumini)
      : order?.commission_duumini != null
        ? Number(order.commission_duumini)
        : null;

  const totalsShare =
    hasTotals && typeof totals.duumini_amount === "number"
      ? Number(totals.duumini_amount)
      : hasTotals && typeof totals.commission === "number"
        ? Number(totals.commission)
        : null;

  let duuShareRaw = Number(direct != null ? direct : totalsShare != null ? totalsShare : 0);
  if (!Number.isFinite(duuShareRaw) || duuShareRaw < 0) duuShareRaw = 0;

  // ✅ Commission Duumini: uniquement DONE
  const duuShare = status === "DONE" ? duuShareRaw : 0;

  return { total, deliveryFee, itemsAmount, duuShare };
}

/* ===== Payment helpers ===== */
type PayStatus = "PAID" | "UNPAID" | "PARTIAL" | "PENDING";

function normPayStatus(s: any): PayStatus | null {
  const v = String(s || "").trim().toUpperCase();
  if (v === "PAID") return "PAID";
  if (v === "UNPAID") return "UNPAID";
  if (v === "PARTIAL") return "PARTIAL";
  if (v === "PENDING") return "PENDING";
  return null;
}

function toInputNumberValue(n: number) {
  return n === 0 ? "" : String(n);
}
function fromInputNumberValue(v: string) {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getPaymentFromOrder(o: AnyObj) {
  const payment = o?.payment && typeof o.payment === "object" ? o.payment : null;

  const status: PayStatus | null = normPayStatus(o?.payment_status) || normPayStatus(payment?.status) || null;

  const paid_amount =
    numSafe(o?.paid_amount) || numSafe(payment?.paid_amount) || numSafe(payment?.paidAmount) || 0;

  const remaining_amount_raw = o?.remaining_amount ?? payment?.remaining_amount ?? payment?.remainingAmount ?? null;
  const remaining_amount = remaining_amount_raw == null ? null : Math.max(0, numSafe(remaining_amount_raw));

  const method = String(payment?.method || o?.payment_method || "").trim() || null;
  const note = payment?.note != null ? String(payment.note) : null;
  const currency = String(payment?.currency || o?.currency || "MAD").toUpperCase();

  return { payment, status, paid_amount, remaining_amount, method, note, currency };
}

function computeRemaining(total: number, paid: number) {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  return Math.max(0, t - p);
}

function computePayStatus(total: number, paid: number): PayStatus {
  const t = Math.max(0, numSafe(total));
  const p = Math.max(0, Math.min(numSafe(paid), t));
  if (t <= 0 || p <= 0) return "UNPAID";
  if (p >= t) return "PAID";
  return "PARTIAL";
}

/**
 * ✅ Paiement badge
 * ✅ Virement: si method=BANK_TRANSFER => badge "EN ATTENTE" (même si status absent)
 */
function getPaymentLabelForRow(o: AnyObj) {
  const oStatus = String(o?.status || "").toUpperCase();
  if (oStatus === "CANCELLED") return { text: "ANNULÉE", cls: "bg-danger" };

  const { total } = computeOrderAmounts(o);
  const pay = getPaymentFromOrder(o);

  const method = String(pay.method || "").toUpperCase();
  const isBank = method === "BANK_TRANSFER" || method === "BANK" || method === "TRANSFER" || method === "VIREMENT";

  const paid = numSafe(pay.paid_amount);
  const remain = computeRemaining(total, paid);

  const explicit = pay.status;

  if (explicit === "PAID") return { text: "PAYÉ", cls: "bg-success" };

  if (explicit === "PENDING") return { text: "VIREMENT: EN ATTENTE", cls: "bg-warning text-dark" };
  if (isBank && (explicit === "UNPAID" || explicit === "PARTIAL" || explicit == null))
    return { text: "VIREMENT: EN ATTENTE", cls: "bg-warning text-dark" };

  if (paid > 0 && remain > 0) return { text: "PARTIEL", cls: "bg-warning text-dark" };
  if (paid >= total && total > 0) return { text: "PAYÉ", cls: "bg-success" };

  return { text: "NON PAYÉ", cls: "bg-secondary" };
}

/**
 * ✅ Montant restant (colonne "Reste" = chiffre)
 * ✅ Ne s'affiche PAS si commande annulée
 */
function getRemainingAmountForRow(o: AnyObj): number | null {
  const st = String(o?.status || "").toUpperCase();
  if (st === "CANCELLED") return null;

  const { total } = computeOrderAmounts(o);
  const pay = getPaymentFromOrder(o);

  // si backend donne remaining_amount, on le respecte
  if (pay?.remaining_amount != null) return Math.max(0, numSafe(pay.remaining_amount));

  const paid = numSafe(pay?.paid_amount);
  return computeRemaining(total, paid);
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

  const f = normFulfillment(order);
  const fLine =
    f === "PICKUP"
      ? "Réception : *Récupération sur place*"
      : f === "EXPEDITION"
        ? "Réception : *Expédition* (dépôt Duumini, frais transporteur payés au retrait)"
        : "Réception : *Livraison*";

  const blocs: string[] = [];
  blocs.push(`Bonjour ${fullName},`);
  blocs.push("");
  blocs.push(`Merci pour votre commande chez *Duumini*`);
  blocs.push(statusText);
  blocs.push("");
  blocs.push(`*Détails de la commande #${displayCode}*`);
  if (created) blocs.push(`Date : ${created}`);
  blocs.push(fLine);
  blocs.push("");
  blocs.push("*Articles*");
  blocs.push(lines);
  blocs.push("");
  blocs.push(`Sous-total : ${mad(itemsAmount)}`);
  blocs.push(`Frais : ${mad(deliveryFee)}`);
  blocs.push(`Total : ${mad(total)}`);
  blocs.push("");

  if (f === "DELIVERY") {
    blocs.push("*Adresse de livraison*");
    if (ville) blocs.push(`Ville : ${ville}`);
    if (commune) blocs.push(`Commune : ${commune}`);
    if (quartier) blocs.push(`Quartier : ${quartier}`);
    blocs.push("");
  }

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

/* =========================
 * ✅ Visibilité vendeur
 * =======================*/
type CurrentUser = {
  id?: number;
  role?: string;
  shop_id?: number | null;
  vendor_id?: number | null;
} & AnyObj;

function isVendorRole(role?: string) {
  const r = String(role || "").toUpperCase();
  return r === "VENDOR" || r === "SELLER" || r === "SHOP" || r === "BOUTIQUE";
}

function orderBelongsToUser(order: AnyObj, user: CurrentUser | null): boolean {
  if (!user) return false;

  // admin voit tout
  if (!isVendorRole(user.role)) return true;

  const uid = Number(user.id ?? user.vendor_id ?? 0) || 0;
  const myShop = user.shop_id != null ? Number(user.shop_id) : null;

  // champs possibles sur order
  const oVendor = order?.vendor_id ?? order?.vendorId ?? order?.seller_id ?? order?.sellerId ?? null;
  const oShop = order?.shop_id ?? order?.shopId ?? order?.store_id ?? order?.storeId ?? null;

  if (oVendor != null && uid && Number(oVendor) === uid) return true;
  if (myShop != null && oShop != null && Number(oShop) === Number(myShop)) return true;

  // parfois c’est par items
  const items: AnyObj[] = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.order_items)
      ? order.order_items
      : Array.isArray(order?.lines)
        ? order.lines
        : [];

  if (items.length) {
    for (const it of items) {
      const itShop = it?.shop_id ?? it?.shopId ?? it?.store_id ?? it?.storeId ?? null;
      const itVendor = it?.vendor_id ?? it?.vendorId ?? it?.seller_id ?? it?.sellerId ?? null;

      if (itVendor != null && uid && Number(itVendor) === uid) return true;
      if (myShop != null && itShop != null && Number(itShop) === Number(myShop)) return true;
    }
  }

  return false;
}

/* ===================== Page ===================== */
export default function OrdersAdminPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const isVendor = useMemo(() => isVendorRole(user?.role), [user?.role]);

  // ✅ source brute (admin) ou collection vendeur (on charge large puis paginate local)
  const [items, setItems] = useState<Order[]>([]);
  const [vendorAll, setVendorAll] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");

  // ✅ filtres backend (status + payment_status)
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [payFilter, setPayFilter] = useState<"ALL" | PayStatus>("ALL");

  // Edition statut (modale rapide)
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  // ✅ Modale Voir/Confirmer
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [viewStatus, setViewStatus] = useState<OrderStatus>("OPEN");
  const [viewSaving, setViewSaving] = useState(false);

  // ✅ paiement dans modale voir
  const [payEditMode, setPayEditMode] = useState<"SET" | "ADD">("ADD");
  const [payInput, setPayInput] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [payNote, setPayNote] = useState<string>("");
  const [paySaving, setPaySaving] = useState(false);

  // Vente sur place (modale)
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
  const [amountPaid, setAmountPaid] = useState<number>(0);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [markDone, setMarkDone] = useState(true);
  const searchAbort = useRef<AbortController | null>(null);

  // ✅ charge user (role, shop_id, id…)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (!mounted) return;
        setUser((u as any) || null);
      } catch {
        if (!mounted) return;
        setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ Mode vendeur: on charge "large" puis on filtre côté client (robuste même si backend ne filtre pas)
      if (isVendor) {
        const res = await listOrders({
          page: 1,
          pageSize: 500, // charge large
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
        } as any);

        const all = (res.items || []) as Order[];
        const mine = all.filter((o) => orderBelongsToUser(o as AnyObj, user));

        setVendorAll(mine);
        setTotal(mine.length);
        setItems([]); // pas utilisé en mode vendeur
        setError(null);
        return;
      }

      // ✅ Admin: pagination backend classique
      const res = await listOrders({
        page,
        pageSize,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(payFilter !== "ALL" ? { payment_status: payFilter } : {}),
      } as any);

      setItems(res.items);
      setTotal(res.pageInfo.total);
      setVendorAll([]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, payFilter, isVendor, user]);

  // ✅ reset page si on change de mode/filters en vendeur
  useEffect(() => {
    if (isVendor) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendor, statusFilter, payFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = subscribeSSE("/api/events/stream", (evt: ServerEvent) => {
      if (evt.type === "ORDER_CREATED" || evt.type === "ORDER_STATUS") {
        refresh();
        // @ts-ignore
        window?.duuminiToast?.({
          title:
            evt.payload?.title ||
            (evt.type === "ORDER_CREATED" ? "Nouvelle commande" : "Commande mise à jour"),
          message: evt.payload?.body || "",
        });
      }
    });
    return () => sub.close();
  }, [refresh]);

  const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");

  // ✅ dataset courant
  const dataset = useMemo(() => (isVendor ? vendorAll : items), [isVendor, vendorAll, items]);

  // ✅ filtre recherche
  const searched = useMemo(() => {
    return dataset.filter((o) => {
      if (!q.trim()) return true;
      const txt = q.toLowerCase();
      const contact = (o as any)?.contact || (o as any)?.user || {};
      const contactName = `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
      return (
        String(o.id).toLowerCase().includes(txt) ||
        (o.status?.toLowerCase() || "").includes(txt) ||
        contactName.toLowerCase().includes(txt) ||
        (contact?.phone || "").toLowerCase().includes(txt)
      );
    });
  }, [dataset, q]);

  // ✅ pagination (admin: déjà paginé backend, vendeur: paginate local)
  const displayed = useMemo(() => {
    if (!isVendor) return searched;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return searched.slice(start, end);
  }, [searched, isVendor, page, pageSize]);

  // ✅ recompute total/pages pour vendeur après recherche
  const effectiveTotal = useMemo(() => {
    if (!isVendor) return total;
    return searched.length;
  }, [isVendor, searched.length, total]);

  const effectivePages = useMemo(() => Math.max(1, Math.ceil(effectiveTotal / pageSize)), [
    effectiveTotal,
    pageSize,
  ]);

  // ✅ Stats: exclure CANCELLED des CA (net + frais), Commission déjà DONE-only
  const globalStats = useMemo(() => {
    let caNet = 0;
    let caDelivery = 0;
    let caDuumini = 0;

    displayed.forEach((o) => {
      const st = String((o as AnyObj)?.status || "").toUpperCase();
      const { itemsAmount, deliveryFee, duuShare } = computeOrderAmounts(o as AnyObj);
      if (st !== "CANCELLED") {
        caNet += itemsAmount;
        caDelivery += deliveryFee;
      }
      caDuumini += duuShare;
    });

    return { caNet, caDelivery, caDuumini };
  }, [displayed]);

  async function onEdit(id: number) {
    try {
      const full = await getOrder(id);
      if (!orderBelongsToUser(full as AnyObj, user)) {
        setError("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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
      const full = await getOrder(id);
      if (!orderBelongsToUser(full as AnyObj, user)) {
        setError("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      await cancelOrder(id);
      await refresh();
      if (viewId === id) {
        setViewId(null);
        setDetail(null);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  async function onWhatsappClick(id: number) {
    try {
      const full = await getOrder(id);
      if (!orderBelongsToUser(full as AnyObj, user)) {
        alert("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
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

    setPayEditMode("ADD");
    setPayInput(0);
    setPayMethod("CASH");
    setPayNote("");

    try {
      const d = await getOrder(id);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      setDetail(d as any);
      setViewStatus((d as any)?.status || "OPEN");

      const pay = getPaymentFromOrder(d as AnyObj);
      if (pay?.method) setPayMethod(pay.method);
      if (pay?.note) setPayNote(String(pay.note || ""));
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
      if (detail && !orderBelongsToUser(detail as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      await updateOrderStatus(viewId, viewStatus);
      await refresh();
      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      setDetail(d as any);
      setViewStatus((d as any)?.status || viewStatus);
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewSaving(false);
    }
  }

  async function onConfirmQuick(status: OrderStatus) {
    if (!viewId) return;
    setViewSaving(true);
    try {
      if (detail && !orderBelongsToUser(detail as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      await updateOrderStatus(viewId, status);
      await refresh();
      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      setDetail(d as any);
      setViewStatus((d as AnyObj)?.status || status);
    } catch (e: any) {
      setViewErr(e?.message || String(e));
    } finally {
      setViewSaving(false);
    }
  }

  async function onSavePayment() {
    if (!viewId || !detail) return;
    if (typeof updateOrderPayment !== "function") return;

    if (!orderBelongsToUser(detail as AnyObj, user)) {
      setViewErr("Accès refusé : cette commande ne vous concerne pas.");
      return;
    }

    const { total } = computeOrderAmounts(detail as AnyObj);
    const curPay = getPaymentFromOrder(detail as AnyObj);
    const currentPaid = numSafe(curPay?.paid_amount);

    const raw = Number(payInput || 0);
    if (!Number.isFinite(raw)) {
      setViewErr("Montant invalide.");
      return;
    }

    if (payEditMode === "ADD") {
      if (raw <= 0) return setViewErr("Le montant à ajouter doit être > 0.");
      if (currentPaid + raw > total + 0.0001) return setViewErr("Vous dépassez le total de la commande.");
    } else {
      if (raw < 0) return setViewErr("Le montant payé ne peut pas être négatif.");
      if (raw > total + 0.0001) return setViewErr("Le montant payé ne peut pas dépasser le total.");
    }

    setPaySaving(true);
    setViewErr(null);
    try {
      const payload =
        payEditMode === "ADD"
          ? { mode: "ADD" as const, add_amount: raw, method: payMethod, note: payNote }
          : { mode: "SET" as const, paid_amount: raw, method: payMethod, note: payNote };

      await updateOrderPayment(viewId, payload as any);

      const d = await getOrder(viewId);
      if (!orderBelongsToUser(d as AnyObj, user)) {
        setViewErr("Accès refusé : cette commande ne vous concerne pas.");
        return;
      }
      setDetail(d as any);
      await refresh();

      setPayInput(0);
    } catch (e: any) {
      setViewErr(e?.message || "Impossible de mettre à jour le paiement.");
    } finally {
      setPaySaving(false);
    }
  }

  const client = (() => {
    const d = detail || {};
    const c = (d as any).contact || (d as any).user || d;
    const first_name = c?.first_name ?? "";
    const last_name = c?.last_name ?? "";
    const phone = c?.phone ?? c?.user_phone ?? "";
    const fullName = `${(first_name || "").trim()} ${(last_name || "").trim()}`.trim() || "—";
    return { first_name, last_name, fullName, phone };
  })();

  const address = (detail?.address as AnyObj) || {};
  const itemsDetail: AnyObj[] = Array.isArray(detail?.items) ? (detail as any).items : [];

  const itemsAmountDetail = itemsDetail.reduce(
    (sum, it) => sum + Number(it?.unit_price ?? it?.price ?? 0) * Number(it?.qty ?? 1),
    0,
  );

  const totalAmountDetail: number =
    typeof detail?.total === "number"
      ? (detail as any).total
      : Number((detail as any)?.totals?.amount ?? itemsAmountDetail);

  const deliveryFeeDetail =
    (detail as AnyObj)?.totals?.delivery_fee ??
    Math.max(0, Number(totalAmountDetail) - Number(itemsAmountDetail));

  const viewPay = useMemo(() => {
    if (!detail) return null;
    const pay = getPaymentFromOrder(detail);
    const { total } = computeOrderAmounts(detail);
    const remaining =
      String(detail?.status || "").toUpperCase() === "CANCELLED"
        ? null
        : pay?.remaining_amount != null
          ? Number(pay.remaining_amount)
          : computeRemaining(total, pay.paid_amount);

    const derived = computePayStatus(total, pay.paid_amount);
    const status = pay?.status || derived;

    return { ...pay, total, remaining, status };
  }, [detail]);

  const viewFulfillment = useMemo(() => (detail ? normFulfillment(detail) : "DELIVERY"), [detail]);
  const viewFulLabel = useMemo(() => fulfillmentLabel(viewFulfillment), [viewFulfillment]);

  const basketTotal = useMemo(() => {
    return basket.reduce((s, it) => s + getProductUnitPrice(it.product) * Number(it.qty || 0), 0);
  }, [basket]);

  const posPaidClamped = useMemo(() => {
    const t = Math.max(0, numSafe(basketTotal));
    const p = Math.max(0, Math.min(numSafe(amountPaid), t));
    return p;
  }, [basketTotal, amountPaid]);

  const posRemaining = useMemo(() => computeRemaining(basketTotal, posPaidClamped), [basketTotal, posPaidClamped]);
  const posStatus = useMemo(() => computePayStatus(basketTotal, posPaidClamped), [basketTotal, posPaidClamped]);

  useEffect(() => {
    if (posPaidClamped !== amountPaid) setAmountPaid(posPaidClamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posPaidClamped]);

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

  function clearBasket() {
    if (!basket.length) return;
    if (!window.confirm("Vider le panier ?")) return;
    setBasket([]);
    setAmountPaid(0);
  }

  const loadAllProducts = useCallback(async () => {
    if (!openCreate) return;

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
        const res = await listProducts({ page, pageSize: pageSizeAll });
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
  }, [openCreate]);

  useEffect(() => {
    if (openCreate) loadAllProducts();
  }, [openCreate, loadAllProducts]);

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
    const paid = posPaidClamped;
    const remain = computeRemaining(total, paid);
    const status = computePayStatus(total, paid);

    const itemsPayload = basket.map((b) => {
      const unit = getProductUnitPrice(b.product);
      return { product_id: b.product.id, qty: b.qty, name: b.product.name, price: Number(unit || 0) };
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
      if (markDone && created?.id) await updateOrderStatus(created.id, "DONE");

      setOpenCreate(false);
      setBasket([]);
      setCFirst("");
      setCLast("");
      setCPhone("");
      setSearch("");
      setResults([]);
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
        <h1 className="h5 m-0">{isVendor ? "Mes commandes" : "Commandes"}</h1>

        <div className="d-flex gap-2">
          {/* ✅ vendeur ne crée pas de ventes sur place depuis l’admin */}
          {!isVendor && (
            <button className="btn btn-duu" onClick={() => setOpenCreate(true)}>
              + Vente sur place
            </button>
          )}

          {!isVendor && (
            <Link to="/admin" className="btn btn-outline-dark">
              Accueil admin
            </Link>
          )}
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
              <div className="text-muted small mb-1">Frais (page)</div>
              <div className="h6 m-0">{mad(globalStats.caDelivery)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">
                CA Duumini (page) <span className="text-muted">(DONE seulement)</span>
              </div>
              <div className="h6 m-0">{mad(globalStats.caDuumini)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ filtres backend */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <input
              className="form-control"
              placeholder="Recherche (#, statut, client, téléphone...)"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              style={{ maxWidth: 420 }}
            />

            <select
              className="form-select"
              style={{ width: 190 }}
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as any);
              }}
              title="Filtrer par statut"
            >
              <option value="ALL">Tous les statuts</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: 220 }}
              value={payFilter}
              onChange={(e) => {
                setPage(1);
                setPayFilter(e.target.value as any);
              }}
              title="Filtrer par paiement"
            >
              <option value="ALL">Tous les paiements</option>
              <option value="PAID">PAYÉ</option>
              <option value="PARTIAL">PARTIEL</option>
              <option value="UNPAID">NON PAYÉ</option>
              <option value="PENDING">EN ATTENTE (virement)</option>
            </select>

            <button className="btn btn-outline-dark" onClick={refresh} disabled={loading}>
              Rafraîchir
            </button>
          </div>

          <div className="text-muted small">
            Page {page}/{effectivePages} • {effectiveTotal} commande(s)
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Chargement…</div>
          ) : displayed.length === 0 ? (
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
                    <th>Réception</th>
                    <th>Paiement</th>
                    <th className="text-end">Reste</th>
                    <th className="text-end">Total</th>
                    <th className="text-end">Commission (DONE)</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((o) => {
                    const c = (o as any)?.contact || (o as any)?.user || {};
                    const fn = (c?.first_name || "").trim();
                    const ln = (c?.last_name || "").trim();
                    const clientName = fn || ln ? `${fn} ${ln}`.trim() : "—";
                    const phone = (c?.phone || "").trim();
                    const hrefTel = telHref(phone);
                    const thumb = getOrderThumb(o as AnyObj);
                    const displayCode = getOrderDisplayCode(o);

                    const { total: totalAligned, duuShare: duuCommission } = computeOrderAmounts(o as AnyObj);
                    const payBadge = getPaymentLabelForRow(o as AnyObj);
                    const remaining = getRemainingAmountForRow(o as AnyObj);
                    const st = String(o.status || "").toUpperCase();

                    const f = normFulfillment(o as AnyObj);
                    const fBadge = fulfillmentLabel(f);

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
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                overflow: "hidden",
                                background: "#f5f5f5",
                              }}
                            >
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

                        <td>
                          <span className={`badge ${fBadge.cls}`}>{fBadge.text}</span>
                        </td>

                        <td>
                          <span className={`badge ${payBadge.cls}`}>{payBadge.text}</span>
                        </td>

                        <td className="text-end">
                          {remaining == null ? <span className="text-muted">—</span> : <span className="fw-semibold">{mad(remaining)}</span>}
                        </td>

                        <td className="text-end">{mad(totalAligned)}</td>

                        <td className="text-end">
                          {st === "DONE" ? <span className="fw-semibold">{mad(duuCommission)}</span> : <span className="text-muted">—</span>}
                        </td>

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
            <div className="text-muted small">{effectiveTotal} élément(s)</div>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-dark" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Préc.
              </button>
              <span className="btn btn-sm btn-outline-dark disabled">
                {page} / {effectivePages}
              </span>
              <button
                className="btn btn-sm btn-outline-dark"
                disabled={page >= effectivePages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===========================
          MODAL: Edition rapide statut
         =========================== */}
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

      {/* ===========================
          MODAL: Voir / Confirmer
         =========================== */}
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
                        <span className={`badge ${BADGE[((detail as AnyObj).status as OrderStatus) || "OPEN"]}`}>
                          {(detail as AnyObj).status}
                        </span>
                        <span className={`badge ${viewFulLabel.cls}`}>{viewFulLabel.text}</span>
                        <small className="text-muted">{dateTime((detail as AnyObj).created_at)}</small>
                      </div>

                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            disabled={viewSaving || (detail as AnyObj).status !== "OPEN"}
                            onClick={() => onConfirmQuick("PREPARATION")}
                            title="Confirmer = passer en préparation"
                          >
                            Confirmer
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={viewSaving || (detail as AnyObj).status !== "PREPARATION"}
                            onClick={() => onConfirmQuick("DELIVERY")}
                            title="Mettre en livraison"
                          >
                            En livraison
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            disabled={
                              viewSaving ||
                              (detail as AnyObj).status === "DONE" ||
                              (detail as AnyObj).status === "CANCELLED"
                            }
                            onClick={() => onConfirmQuick("DONE")}
                            title="Marquer comme livrée"
                          >
                            Livrée
                          </button>
                        </div>

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
                          {viewSaving ? "…" : "Enregistrer"}
                        </button>
                      </div>
                    </div>

                    <div className="row g-3">
                      <div className="col-12 col-lg-6">
                        <div className="card border-0 shadow-sm mb-3">
                          <div className="card-body">
                            <h6 className="mb-2">Client</h6>
                            <div className="d-flex flex-wrap justify-content-between align-items-center">
                              <div>
                                <div className="fw-semibold">{client.fullName}</div>
                                <div className="text-muted small">{client.phone || "—"}</div>
                              </div>
                              <div className="d-flex gap-2">
                                <a
                                  className="btn btn-sm btn-success"
                                  href={waHref(detail as AnyObj)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
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

                        {/* ✅ Adresse seulement si LIVRAISON */}
                        {viewFulfillment === "DELIVERY" ? (
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
                              {(detail as AnyObj)?.geo_link ? (
                                <div className="mt-2">
                                  <a
                                    className="btn btn-sm btn-outline-secondary"
                                    href={(detail as AnyObj).geo_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Ouvrir dans Google Maps
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="card border-0 shadow-sm mb-3">
                            <div className="card-body">
                              <h6 className="mb-2">Réception</h6>
                              {viewFulfillment === "PICKUP" ? (
                                <div className="text-muted small">Récupération sur place (aucune adresse client).</div>
                              ) : (
                                <div className="text-muted small">
                                  Expédition : Duumini dépose le colis (frais dépôt). Le client paie le transporteur au retrait.
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ===== Paiement ===== */}
                        <div className="card border-0 shadow-sm">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h6 className="m-0">Paiement</h6>
                              {viewPay ? (
                                <span
                                  className={`badge ${
                                    viewPay.status === "PAID"
                                      ? "bg-success"
                                      : viewPay.status === "PARTIAL"
                                        ? "bg-warning text-dark"
                                        : viewPay.status === "PENDING"
                                          ? "bg-warning text-dark"
                                          : "bg-secondary"
                                  }`}
                                >
                                  {viewPay.status === "PAID"
                                    ? "PAYÉ"
                                    : viewPay.status === "PARTIAL"
                                      ? "PARTIEL"
                                      : viewPay.status === "PENDING"
                                        ? "EN ATTENTE"
                                        : "NON PAYÉ"}
                                </span>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </div>

                            {viewPay ? (
                              <>
                                <div className="d-flex justify-content-between small">
                                  <span className="text-muted">Total</span>
                                  <span className="fw-semibold">{mad(viewPay.total)}</span>
                                </div>
                                <div className="d-flex justify-content-between small">
                                  <span className="text-muted">Payé</span>
                                  <span className="fw-semibold">{mad(viewPay.paid_amount)}</span>
                                </div>
                                <div className="d-flex justify-content-between small mb-2">
                                  <span className="text-muted">Reste</span>
                                  <span className="fw-semibold">
                                    {viewPay.remaining == null ? <span className="text-muted">—</span> : mad(viewPay.remaining)}
                                  </span>
                                </div>

                                {(viewPay.method || viewPay.note) && (
                                  <div className="small text-muted">
                                    {viewPay.method ? <div>Méthode: {String(viewPay.method)}</div> : null}
                                    {viewPay.note ? <div>Note: {String(viewPay.note)}</div> : null}
                                  </div>
                                )}

                                {typeof updateOrderPayment === "function" ? (
                                  <div className="mt-3">
                                    <div className="row g-2">
                                      <div className="col-12 col-md-4">
                                        <select
                                          className="form-select form-select-sm"
                                          value={payEditMode}
                                          onChange={(e) => setPayEditMode(e.target.value as any)}
                                          disabled={paySaving}
                                        >
                                          <option value="ADD">Ajouter</option>
                                          <option value="SET">Fixer</option>
                                        </select>
                                      </div>
                                      <div className="col-12 col-md-4">
                                        <input
                                          type="number"
                                          min={0}
                                          step="1"
                                          className="form-control form-control-sm"
                                          placeholder={payEditMode === "ADD" ? "Montant à ajouter" : "Montant payé"}
                                          value={toInputNumberValue(payInput)}
                                          onChange={(e) => setPayInput(fromInputNumberValue(e.target.value))}
                                          disabled={paySaving}
                                        />
                                      </div>
                                      <div className="col-12 col-md-4">
                                        <input
                                          className="form-control form-control-sm"
                                          placeholder="Méthode (COD, CASH, BANK_TRANSFER…)"
                                          value={payMethod}
                                          onChange={(e) => setPayMethod(e.target.value)}
                                          disabled={paySaving}
                                        />
                                      </div>
                                      <div className="col-12">
                                        <input
                                          className="form-control form-control-sm"
                                          placeholder="Note (optionnel)"
                                          value={payNote}
                                          onChange={(e) => setPayNote(e.target.value)}
                                          disabled={paySaving}
                                        />
                                      </div>
                                    </div>
                                    <div className="d-flex justify-content-end mt-2">
                                      <button className="btn btn-sm btn-dark" onClick={onSavePayment} disabled={paySaving}>
                                        {paySaving ? "…" : "Mettre à jour paiement"}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <div className="text-muted small">Paiement non disponible.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ===== Articles + Totaux ===== */}
                      <div className="col-12 col-lg-6">
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
                                  <li
                                    key={i}
                                    className="list-group-item d-flex justify-content-between align-items-center gap-2"
                                  >
                                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                                      {img ? (
                                        <div
                                          style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            background: "#f5f5f5",
                                          }}
                                        >
                                          <img
                                            src={img}
                                            alt={name}
                                            className="w-100 h-100 object-fit-cover"
                                            loading="lazy"
                                          />
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

                              {deliveryFeeDetail > 0 && (
                                <li className="list-group-item d-flex justify-content-between align-items-center">
                                  <span className="text-muted">Frais</span>
                                  <span className="fw-semibold">{mad(deliveryFeeDetail)}</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="text-muted">Sous-total</div>
                              <div className="fw-semibold">{mad(itemsAmountDetail)}</div>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="text-muted">Total</div>
                              <div className="h6 m-0">{mad(totalAmountDetail)}</div>
                            </div>
                          </div>
                        </div>

                        {(detail as AnyObj)?.status !== "CANCELLED" && (detail as AnyObj)?.status !== "DONE" ? (
                          <div className="d-flex justify-content-end mt-3">
                            <button className="btn btn-outline-danger" onClick={() => onCancel(viewId)} disabled={viewSaving}>
                              Annuler la commande
                            </button>
                          </div>
                        ) : null}
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

      {/* ===========================
          MODAL: Vente sur place (scroll fixé)
          ✅ admin seulement
         =========================== */}
      {!isVendor && openCreate && (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content pos-modal">
              <div className="modal-header pos-sticky-header">
                <h5 className="modal-title">Vente sur place</h5>
                <button className="btn-close" onClick={() => setOpenCreate(false)} />
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
                          <button className="btn btn-sm btn-outline-dark" onClick={loadAllProducts} disabled={searchLoading}>
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
                            />
                          </div>
                          <div className="col-12 col-md-3">
                            <select className="form-select" value={promoFilter} onChange={(e) => setPromoFilter(e.target.value as any)}>
                              <option value="ALL">Tous</option>
                              <option value="PROMO">Promos</option>
                              <option value="NO_PROMO">Sans promo</option>
                            </select>
                          </div>
                          <div className="col-12 col-md-3">
                            <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
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
                                  <div key={p.id} className="d-flex justify-content-between align-items-center border rounded p-2">
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

                                    <button className="btn btn-sm btn-duu" onClick={() => addToBasket(p)}>
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
                          <button className="btn btn-sm btn-outline-danger" onClick={clearBasket} disabled={!basket.length}>
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
                            <span className="fw-semibold">{mad(posPaidClamped)}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted">Reste</span>
                            <span className="fw-semibold">{mad(posRemaining)}</span>
                          </div>
                          <div className="mt-2">
                            <span
                              className={`badge ${
                                posStatus === "PAID"
                                  ? "bg-success"
                                  : posStatus === "PARTIAL"
                                    ? "bg-warning text-dark"
                                    : "bg-secondary"
                              }`}
                            >
                              {posStatus === "PAID" ? "PAYÉ" : posStatus === "PARTIAL" ? "PARTIEL" : "NON PAYÉ"}
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
                                    />
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => removeLine(ln.product.id)}>
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
                        />

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

                        <div className="form-check mt-3">
                          <input className="form-check-input" type="checkbox" id="markDone" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
                          <label className="form-check-label" htmlFor="markDone">
                            Marquer comme <strong>livrée (DONE)</strong> après création
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer pos-sticky-footer">
                <button className="btn btn-outline-dark" onClick={() => setOpenCreate(false)} disabled={saving}>
                  Fermer
                </button>
                <button className="btn btn-dark" onClick={submitCreate} disabled={saving || basket.length === 0}>
                  {saving ? "Enregistrement…" : "Créer la vente"}
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
  );
}
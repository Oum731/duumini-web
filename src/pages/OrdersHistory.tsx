// src/pages/OrdersHistoryPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listOrders,
  getOrder,
  cancelOrder,
  type Order,
  type OrderDetail,
  type OrderStatus,
  type OrderItem,
} from "../services/orders";
import { mad } from "../store/cart";
import { API_BASE } from "../services/http";

import OrderReceiptButton from "../components/orders/OrderReceiptButton";
import OrderReceiptTicket from "../components/orders/OrderReceiptTicket";

/* ===== Helpers image ===== */
function imgUrl(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

/** Image de produit robuste (pour l’UI, PAS WhatsApp) */
function getItemImage(it: OrderItem): string {
  const anyIt = it as any;
  const raw =
    (it as any).product_cover ||
    (it as any).image_url ||
    (it as any).cover ||
    anyIt.product_image ||
    anyIt.image ||
    anyIt.thumb ||
    anyIt.thumbnail ||
    (anyIt.product &&
      (anyIt.product.product_cover ||
        anyIt.product.image_url ||
        anyIt.product.cover ||
        anyIt.product.image ||
        anyIt.product.thumb)) ||
    null;

  return imgUrl(raw || "");
}

/* ===== UI helpers statut ===== */
const STATUS_LABEL: Record<OrderStatus, string> = {
  OPEN: "Ouverte",
  PREPARATION: "Préparation",
  DELIVERY: "En livraison",
  DONE: "Livrée",
  CANCELLED: "Annulée",
};

function statusBadge(s: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    OPEN: "secondary",
    PREPARATION: "warning",
    DELIVERY: "info",
    DONE: "success",
    CANCELLED: "danger",
  };
  const label = STATUS_LABEL[s] || s;
  const cls = map[s] || "secondary";
  return <span className={`badge text-bg-${cls}`}>{label}</span>;
}

function getStatusLabel(s?: OrderStatus) {
  if (!s) return "Inconnu";
  return STATUS_LABEL[s] || s;
}

/** Nom de produit robuste */
function getItemName(it: OrderItem): string {
  return (
    (it as any)?.product_name ||
    (it as any)?.name ||
    `Produit #${(it as any)?.product_id ?? ""}`
  );
}

/** Variante label robuste */
function getItemVariantLabel(it: OrderItem): string {
  const anyIt = it as any;
  return String(
    (it as any)?.variant_label ||
      anyIt?.variantLabel ||
      anyIt?.variant_name ||
      anyIt?.variant ||
      "",
  )
    .trim()
    .replace(/\s+/g, " ");
}

type ListOrDetail = Order & Partial<OrderDetail>;

/* ===== Helper: code alphanumérique pour affichage ===== */
function getOrderDisplayCode(
  orderOrId: { id: number | string } | number | string,
): string {
  const rawId =
    typeof orderOrId === "number" || typeof orderOrId === "string"
      ? orderOrId
      : orderOrId.id;

  const num = typeof rawId === "number" ? rawId : Number(rawId);
  if (Number.isFinite(num) && num > 0) return num.toString(36).toUpperCase();
  return String(rawId ?? "").toUpperCase();
}

/* =========================
   ✅ PROMO (inspiré checkout)
   ========================= */
function toNum(x: any): number | null {
  if (x === undefined || x === null) return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type ItemPricing = {
  qty: number;
  unitFinal: number;
  unitBase: number | null;
  hasPromo: boolean;
  discountLabel: string;
  lineTotal: number;
};

function getOrderItemPricing(it: any): ItemPricing {
  const qty = Math.max(1, Number(it?.qty ?? 1) || 1);

  const unitFinal =
    toNum(it?.unit_price) ??
    toNum(it?.price) ??
    toNum(it?.unitPrice) ??
    toNum(it?.final_unit_price) ??
    0;

  const unitBase =
    toNum(it?.base_unit_price) ??
    toNum(it?.original_unit_price) ??
    toNum(it?.unit_price_before_discount) ??
    toNum(it?.price_before_discount) ??
    toNum(it?.old_unit_price) ??
    toNum(it?.was_unit_price) ??
    null;

  const rawType = String(
    it?.promo_discount_type ?? it?.promo_type ?? "",
  ).toUpperCase();
  const dv = Number(it?.promo_discount_value ?? it?.discount_value ?? 0) || 0;

  const hasPromo =
    (unitBase != null &&
      unitBase > 0 &&
      unitFinal > 0 &&
      unitFinal < unitBase) ||
    Number(it?.promo_applied ?? it?.is_promo ?? 0) === 1;

  let discountLabel = "";
  if (hasPromo) {
    if (dv > 0) {
      const isPercent = rawType.includes("PERC") || dv <= 100;
      discountLabel = isPercent ? `-${Math.round(dv)}%` : `-${mad(dv)}`;
    } else if (unitBase != null && unitBase > 0) {
      const pct = Math.round(((unitBase - unitFinal) / unitBase) * 100);
      if (pct > 0 && pct <= 95) discountLabel = `-${pct}%`;
    }
  }

  const lineTotal = unitFinal * qty;
  return {
    qty,
    unitFinal,
    unitBase: hasPromo ? unitBase : null,
    hasPromo,
    discountLabel,
    lineTotal,
  };
}

/* =========================
   ✅ Livraison (nouveau modèle)
   ========================= */
type DeliveryMode = "CASABLANCA" | "CITY";

const DELIVERY_WINDOW = { startHour: 9, endHour: 20 };

function inferDeliveryMode(order: ListOrDetail): DeliveryMode {
  const anyOrder = order as any;

  const raw =
    anyOrder?.delivery?.mode ??
    anyOrder?.delivery_mode ??
    anyOrder?.deliveryMode ??
    "";
  const s = String(raw || "").toUpperCase();

  if (s.includes("CASA")) return "CASABLANCA";
  if (s === "CITY") return "CITY";

  const city = String(
    anyOrder?.address?.city ||
      anyOrder?.address?.ville ||
      anyOrder?.address_city ||
      "",
  ).toLowerCase();
  if (city.includes("casa")) return "CASABLANCA";

  return "CITY";
}

function computeEtaWindow(
  createdAt: Date,
  mode: DeliveryMode,
): { start: Date; end: Date } {
  const minStart = mode === "CASABLANCA" ? 25 : 60;
  const minEnd = mode === "CASABLANCA" ? 90 : 180;

  const start = new Date(createdAt.getTime() + minStart * 60_000);
  const end = new Date(createdAt.getTime() + minEnd * 60_000);
  return { start, end };
}

function formatTimeLabel(d: Date): string {
  const s = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return s.replace(":", "h");
}
function formatTimeRange(start: Date, end: Date): string {
  return `${formatTimeLabel(start)} et ${formatTimeLabel(end)}`;
}
function formatCountdownMs(ms: number): string | null {
  if (ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  return `${s}s`;
}

function clampToDeliveryHours(d: Date, startHour = 9, endHour = 20): Date {
  const x = new Date(d);
  const h = x.getHours();

  if (h < startHour) {
    x.setHours(startHour, 0, 0, 0);
    return x;
  }
  if (h >= endHour) {
    x.setDate(x.getDate() + 1);
    x.setHours(startHour, 0, 0, 0);
    return x;
  }
  return x;
}

function buildDeliveryWindowMessage(opts: {
  status: OrderStatus;
  createdAtDate: Date | null;
  etaStart: Date | null;
  etaEnd: Date | null;
}) {
  const { status, createdAtDate, etaStart, etaEnd } = opts;

  const base = `⏰ Nous livrons entre ${String(DELIVERY_WINDOW.startHour).padStart(2, "0")}h et ${String(
    DELIVERY_WINDOW.endHour,
  ).padStart(2, "0")}h.`;

  if (!createdAtDate || !etaStart || !etaEnd) return base;

  const cStart = clampToDeliveryHours(
    etaStart,
    DELIVERY_WINDOW.startHour,
    DELIVERY_WINDOW.endHour,
  );
  const cEnd = clampToDeliveryHours(
    etaEnd,
    DELIVERY_WINDOW.startHour,
    DELIVERY_WINDOW.endHour,
  );

  const hadClamp =
    cStart.getTime() !== etaStart.getTime() ||
    cEnd.getTime() !== etaEnd.getTime();
  if (!hadClamp) return base;

  if (status === "OPEN" || status === "PREPARATION") {
    return `${base} Si l’estimation dépasse 20h, la livraison sera reportée au prochain créneau (à partir de 09h).`;
  }
  if (status === "DELIVERY") {
    return `${base} Si l’estimation dépasse 20h, l’équipe vous contacte et la livraison se fait au prochain créneau (dès 09h).`;
  }
  return base;
}

/* ===== Helper: construction du message WhatsApp ===== */
function buildWhatsappText(opts: {
  order: ListOrDetail;
  items: OrderItem[];
  itemsAmount: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status?: OrderStatus;
}) {
  const {
    order,
    items,
    itemsAmount,
    deliveryFee,
    totalAmount,
    currency,
    status,
  } = opts;

  const anyOrder = order as any;
  const contact = anyOrder.contact || {};
  const address = anyOrder.address || {};

  const created = order?.created_at
    ? new Date(order.created_at).toLocaleString("fr-FR")
    : anyOrder.date
      ? new Date(anyOrder.date).toLocaleString("fr-FR")
      : "";

  const displayCode = getOrderDisplayCode(order);

  const linesText =
    items.length === 0
      ? "- (détails indisponibles)"
      : items
          .map((it: any) => {
            const name = getItemName(it);
            const vLabel = getItemVariantLabel(it);
            const p = getOrderItemPricing(it);
            const label = vLabel ? `${name} — ${vLabel}` : name;

            const basePart =
              p.hasPromo && p.unitBase != null && p.unitBase > p.unitFinal
                ? ` (avant: ${mad(p.unitBase)})`
                : "";

            return `* ${label} x${p.qty} = ${mad(p.lineTotal)}${basePart}`;
          })
          .join("\n");

  const contactName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const phone = contact.phone || anyOrder.phone || "";

  const ville = address.city || address.ville || anyOrder.address_city || "";
  const commune = address.commune || anyOrder.address_commune || "";
  const quartier =
    address.district || address.quartier || anyOrder.address_district || "";

  const statusLabel = getStatusLabel(status);

  const parts: string[] = [];
  parts.push(
    `Bonjour, je souhaite avoir des infos sur ma commande #${displayCode}.`,
  );
  if (created) parts.push(`Date de la commande : ${created}`);

  parts.push("");
  parts.push("📦 Récapitulatif de la commande");
  parts.push(linesText);

  parts.push("");
  parts.push(`Sous-total articles: ${mad(itemsAmount)}`);
  if (deliveryFee > 0) parts.push(`Livraison: ${mad(deliveryFee)}`);
  parts.push(`Total: ${mad(totalAmount)} (${currency})`);

  parts.push("");
  parts.push("👤 Coordonnées");
  if (contactName) parts.push(`Nom: ${contactName}`);
  if (phone) parts.push(`Téléphone: ${phone}`);

  if (ville || commune || quartier) {
    parts.push("");
    parts.push("📍 Adresse de livraison");
    if (ville) parts.push(`Ville: ${ville}`);
    if (commune) parts.push(`Commune: ${commune}`);
    if (quartier) parts.push(`Quartier: ${quartier}`);
  }

  if (statusLabel) {
    parts.push("");
    parts.push(`Statut actuel: ${statusLabel}`);
  }

  parts.push("");
  parts.push("Merci.");

  return parts.join("\n");
}

function whatsappHref(opts: {
  order: ListOrDetail;
  items: OrderItem[];
  itemsAmount: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status?: OrderStatus;
}) {
  const text = encodeURIComponent(buildWhatsappText(opts));
  return `https://wa.me/212623677884?text=${text}`;
}

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<ListOrDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [params] = useSearchParams();

  // ✅ Modal reçu
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderDetail | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptErr, setReceiptErr] = useState<string | null>(null);

  const selectedId = useMemo(() => {
    const raw = params.get("order");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- Chargement des commandes ---------- */
  const fetchOrders = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const res = await listOrders({ page: 1, pageSize: 20, mineOnly: true });
      const baseList: Order[] = res?.items ?? [];

      const details = await Promise.allSettled(
        baseList.map((o) => getOrder(o.id)),
      );

      const merged: ListOrDetail[] = baseList.map((o, i) => {
        const d = details[i];
        if (d && d.status === "fulfilled")
          return { ...o, ...d.value } as ListOrDetail;
        return o as ListOrDetail;
      });

      setOrders(merged);
    } catch (e: any) {
      setErr(e?.message || "Impossible de charger vos commandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 12000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const da = new Date(
          (a as any)?.created_at || (a as any)?.date || 0,
        ).getTime();
        const db = new Date(
          (b as any)?.created_at || (b as any)?.date || 0,
        ).getTime();
        return db - da;
      }),
    [orders],
  );

  async function onCancelOrder(
    id: number,
    status: OrderStatus | string | undefined,
  ) {
    const s = (status || "OPEN").toUpperCase() as OrderStatus;
    const canCancel = s === "OPEN" || s === "PREPARATION";
    if (!canCancel) return;

    const ok = window.confirm(
      "Voulez-vous vraiment annuler cette commande ?\n\n" +
        "Vous pouvez annuler tant que la commande n’est pas encore en statut « En livraison ».",
    );
    if (!ok) return;

    try {
      setCancelingId(id);
      await cancelOrder(id);
      await fetchOrders();
    } catch (e: any) {
      setErr(e?.message || "Annulation impossible pour le moment.");
    } finally {
      setCancelingId(null);
    }
  }

  async function openReceipt(orderId: number) {
    try {
      setReceiptErr(null);
      setReceiptLoading(true);
      setReceiptOpen(true);

      const d = await getOrder(orderId);
      setReceiptOrder(d);
    } catch (e: any) {
      setReceiptErr(e?.message || "Impossible de charger le reçu.");
    } finally {
      setReceiptLoading(false);
    }
  }

  function closeReceipt() {
    setReceiptOpen(false);
    setReceiptOrder(null);
    setReceiptErr(null);
  }

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <style>{`
          .orders-history .price-old{ text-decoration: line-through; opacity:.7; margin-right:.35rem; white-space:nowrap; }
          .orders-history .price-new{ font-weight:800; color: var(--duu-red); white-space:nowrap; }
          .orders-history .badge-duu{ background: var(--duu-yellow); color:#111; border:1px solid rgba(0,0,0,.08); }
          .orders-history .btn-duu{ background:#111; color: var(--duu-yellow); border:1px solid #111; }
          .orders-history .btn-duu:hover{ opacity:.92; }
        `}</style>
        <h1 className="h4 mb-3">Mes commandes</h1>
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

  return (
    <section className="container-xxl py-4 orders-history">
      <style>{`
        .orders-history .price-old{ text-decoration: line-through; opacity:.7; margin-right:.35rem; white-space:nowrap; }
        .orders-history .price-new{ font-weight:800; color: var(--duu-red); white-space:nowrap; }
        .orders-history .badge-duu{ background: var(--duu-yellow); color:#111; border:1px solid rgba(0,0,0,.08); }
        .orders-history .btn-duu{ background:#111; color: var(--duu-yellow); border:1px solid #111; font-weight:800; }
        .orders-history .btn-duu:hover{ opacity:.92; }
        .orders-history .modal-backdrop-duu{
          position: fixed; inset:0; background: rgba(0,0,0,.55); z-index: 1050;
          display:flex; align-items:flex-start; justify-content:center; padding: 24px 12px;
          overflow:auto;
        }
        .orders-history .modal-card-duu{
          width: min(980px, 100%);
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,.28);
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.08);
        }
        .orders-history .modal-head-duu{
          display:flex; align-items:center; justify-content:space-between; gap: 10px;
          padding: 12px 14px; background: #fff;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        .orders-history .modal-title-duu{ font-weight: 900; }
        .orders-history .modal-body-duu{ padding: 12px; }
      `}</style>

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h4 m-0">Mes commandes</h1>
        <Link to="/" className="btn btn-outline-dark">
          Continuer mes achats
        </Link>
      </div>

      <div
        className="alert alert-warning"
        role="status"
        style={{ borderLeft: `4px solid var(--duu-red)` }}
      >
        <div className="fw-semibold" style={{ color: "var(--duu-black)" }}>
          Vous pouvez annuler votre commande tant qu’elle n’est pas encore en
          statut <em>En livraison</em>.
        </div>
        <small className="text-muted">
          Une fois la commande passée en livraison, l’annulation n’est plus
          possible.
        </small>
      </div>

      <div
        className="alert alert-info"
        role="status"
        style={{ borderLeft: `4px solid var(--duu-yellow)` }}
      >
        <div className="fw-semibold" style={{ color: "var(--duu-black)" }}>
          ⏰ Période de livraison : nous livrons chaque jour entre{" "}
          <strong>09h</strong> et <strong>20h</strong>.
        </div>
        <small className="text-muted">
          Si une estimation dépasse <strong>20h</strong>, la livraison est
          reportée au prochain créneau (à partir de <strong>09h</strong>).
        </small>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {sorted.length === 0 ? (
        <div className="text-center text-muted py-5">
          <p className="mb-3">Vous n’avez pas encore de commande.</p>
          <Link to="/" className="btn btn-dark">
            Parcourir les produits
          </Link>
        </div>
      ) : (
        <div className="vstack gap-3">
          {sorted.map((o) => {
            const displayCode = getOrderDisplayCode(o);

            const created = (o as any)?.created_at
              ? new Date((o as any).created_at).toLocaleString("fr-FR")
              : "";

            const createdAtDate = (o as any)?.created_at
              ? new Date((o as any).created_at)
              : (o as any)?.date
                ? new Date((o as any).date)
                : null;

            const items: OrderItem[] = Array.isArray((o as any)?.items)
              ? (o as any).items
              : [];
            const totals = (o as any)?.totals as
              | OrderDetail["totals"]
              | undefined;

            const itemsAmount: number =
              (typeof totals?.items_amount === "number"
                ? totals.items_amount
                : null) ??
              items.reduce(
                (sum, it: any) => sum + getOrderItemPricing(it).lineTotal,
                0,
              );

            const totalAmount: number =
              (typeof (o as any)?.total === "number"
                ? (o as any).total
                : null) ??
              (typeof totals?.amount === "number" ? totals.amount : null) ??
              itemsAmount;

            const deliveryFee: number =
              (typeof totals?.delivery_fee === "number"
                ? totals.delivery_fee
                : null) ?? Math.max(0, totalAmount - itemsAmount);

            const currency = String(
              totals?.currency || (o as any)?.currency || "MAD",
            ).toUpperCase();

            const isHighlighted = selectedId === (o as any).id;

            const status = String(
              (o as any)?.status || "OPEN",
            ).toUpperCase() as OrderStatus;
            const canCancel = status === "OPEN" || status === "PREPARATION";

            const waUrl = whatsappHref({
              order: o,
              items,
              itemsAmount,
              deliveryFee,
              totalAmount,
              currency,
              status,
            });

            const deliveryMode: DeliveryMode = inferDeliveryMode(o);

            let etaRangeLabel: string | null = null;
            let etaStart: Date | null = null;
            let etaEnd: Date | null = null;

            if (
              createdAtDate &&
              (status === "OPEN" || status === "PREPARATION")
            ) {
              const w = computeEtaWindow(createdAtDate, deliveryMode);
              etaStart = clampToDeliveryHours(
                w.start,
                DELIVERY_WINDOW.startHour,
                DELIVERY_WINDOW.endHour,
              );
              etaEnd = clampToDeliveryHours(
                w.end,
                DELIVERY_WINDOW.startHour,
                DELIVERY_WINDOW.endHour,
              );
              etaRangeLabel = formatTimeRange(etaStart, etaEnd);
            }

            let countdownText: string | null = null;
            if (status === "DELIVERY" && createdAtDate) {
              const anyOrder = o as any;
              const deliveryObj = anyOrder.delivery || {};

              const deliveryStart: Date = deliveryObj.started_at
                ? new Date(deliveryObj.started_at)
                : anyOrder.delivery_started_at
                  ? new Date(anyOrder.delivery_started_at)
                  : createdAtDate;

              const driverEtaSeconds =
                typeof deliveryObj.driver_eta_seconds === "number"
                  ? deliveryObj.driver_eta_seconds
                  : null;

              let remainingMs: number | null = null;

              if (driverEtaSeconds && driverEtaSeconds > 0) {
                const etaTarget = new Date(
                  deliveryStart.getTime() + driverEtaSeconds * 1000,
                );
                remainingMs = etaTarget.getTime() - nowTs;
              } else {
                const defaultTarget =
                  deliveryMode === "CASABLANCA"
                    ? new Date(deliveryStart.getTime() + 90 * 60_000)
                    : new Date(deliveryStart.getTime() + 180 * 60_000);
                remainingMs = defaultTarget.getTime() - nowTs;
              }

              if (remainingMs && remainingMs > 0)
                countdownText = formatCountdownMs(remainingMs);
            }

            const hasPromoOrder = items.some(
              (it: any) => getOrderItemPricing(it).hasPromo,
            );

            const deliveryWindowMsg = buildDeliveryWindowMessage({
              status,
              createdAtDate,
              etaStart,
              etaEnd,
            });

            return (
              <div
                key={(o as any).id}
                className={`card border-0 shadow-sm ${isHighlighted ? "border border-dark" : ""}`}
              >
                <div className="card-body">
                  {/* En-tête commande */}
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <div className="h6 m-0">Commande #{displayCode}</div>
                      {statusBadge(status)}
                      {hasPromoOrder && (
                        <span className="badge badge-duu">Promo appliquée</span>
                      )}
                    </div>
                    <div className="text-muted small">{created}</div>
                  </div>

                  {/* ✅ actions “reçu” (PDF + aperçu ticket) */}
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <OrderReceiptButton orderId={(o as any).id} />
                    <button
                      type="button"
                      className="btn btn-duu btn-sm"
                      onClick={() => openReceipt((o as any).id)}
                      aria-label={`Voir le reçu de la commande #${displayCode}`}
                    >
                      Voir le reçu
                    </button>
                  </div>

                  {/* ✅ Message précis plage de livraison */}
                  <div className="alert alert-light border py-2 px-3 mt-2 mb-0 small">
                    <span className="fw-semibold">{deliveryWindowMsg}</span>
                  </div>

                  {/* ETA / livraison */}
                  {etaRangeLabel && (
                    <div className="alert alert-info py-2 px-3 mt-2 mb-0 small">
                      <span className="fw-semibold">
                        Estimation de livraison :
                      </span>{" "}
                      entre <strong>{etaRangeLabel}</strong>
                      {deliveryMode === "CASABLANCA" ? " (Casablanca)." : "."}
                    </div>
                  )}

                  {status === "DELIVERY" && (
                    <div className="alert alert-info py-2 px-3 mt-2 mb-0 small">
                      <span className="fw-semibold">
                        Votre commande est en cours de livraison.
                      </span>{" "}
                      {countdownText ? (
                        <>
                          Arrivée estimée dans{" "}
                          <strong style={{ color: "var(--duu-red)" }}>
                            {countdownText}
                          </strong>
                          .
                        </>
                      ) : (
                        <>
                          Elle devrait arriver{" "}
                          <strong>dans quelques instants</strong>.
                        </>
                      )}
                    </div>
                  )}

                  {/* Articles */}
                  <h3 className="h6 mt-3 mb-2">Articles de la commande</h3>
                  <ul className="list-group list-group-flush">
                    {items.map((it: any, idx) => {
                      const name = getItemName(it);
                      const vLabel = getItemVariantLabel(it);
                      const img = getItemImage(it);

                      const p = getOrderItemPricing(it);

                      return (
                        <li
                          key={idx}
                          className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                        >
                          <div
                            className="d-flex align-items-center gap-2 flex-grow-1"
                            style={{ minWidth: 0 }}
                          >
                            {img ? (
                              <div
                                className="flex-shrink-0"
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
                              <div
                                className="fw-semibold text-truncate"
                                title={name}
                              >
                                {name}
                              </div>

                              {vLabel && (
                                <div
                                  className="small text-muted text-truncate"
                                  title={vLabel}
                                >
                                  Variante : {vLabel}
                                </div>
                              )}

                              <div className="small text-muted d-flex flex-wrap align-items-center gap-1">
                                {p.hasPromo &&
                                p.unitBase != null &&
                                p.unitBase > p.unitFinal ? (
                                  <>
                                    <span className="price-old">
                                      {mad(p.unitBase)}
                                    </span>
                                    <span className="price-new">
                                      {mad(p.unitFinal)}
                                    </span>
                                    {p.discountLabel ? (
                                      <span className="badge text-bg-warning ms-1">
                                        {p.discountLabel}
                                      </span>
                                    ) : (
                                      <span className="badge text-bg-warning ms-1">
                                        Promo
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="fw-semibold">
                                    {mad(p.unitFinal)}
                                  </span>
                                )}
                                <span className="text-muted">×{p.qty}</span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="fw-semibold text-end"
                            style={{ minWidth: 110, fontSize: "0.9rem" }}
                          >
                            {mad(p.lineTotal)}
                          </div>
                        </li>
                      );
                    })}

                    {deliveryFee > 0 && (
                      <li className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <span className="text-muted">Livraison</span>
                        <div
                          className="text-end"
                          style={{ minWidth: 110, fontSize: "0.9rem" }}
                        >
                          <span className="fw-semibold">
                            {mad(deliveryFee)}
                          </span>
                        </div>
                      </li>
                    )}
                  </ul>

                  {/* Totaux */}
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                    <div className="text-muted">Sous-total articles</div>
                    <div
                      className="fw-semibold"
                      style={{ minWidth: 110, textAlign: "right" }}
                    >
                      {mad(itemsAmount)}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div className="text-muted">Total</div>
                    <div
                      className="h6 m-0"
                      style={{
                        minWidth: 110,
                        textAlign: "right",
                        fontSize: "1rem",
                      }}
                    >
                      {mad(totalAmount)}{" "}
                      <span className="text-muted small">{currency}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success"
                      aria-label={`Contacter via WhatsApp pour la commande #${displayCode}`}
                    >
                      WhatsApp Support
                    </a>

                    <Link
                      to={`/orders?order=${(o as any).id}`}
                      className="btn btn-outline-dark"
                    >
                      Actualiser l’état
                    </Link>

                    {canCancel && (
                      <button
                        className="btn btn-outline-danger"
                        disabled={cancelingId === (o as any).id}
                        onClick={() => onCancelOrder((o as any).id, status)}
                        title="Annuler la commande"
                      >
                        {cancelingId === (o as any).id
                          ? "Annulation…"
                          : "Annuler la commande"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ MODAL REÇU (aperçu ticket + impression) */}
      {receiptOpen && (
        <div
          className="modal-backdrop-duu"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeReceipt();
          }}
        >
          <div
            className="modal-card-duu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head-duu">
              <div className="modal-title-duu">Reçu Duumini</div>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                onClick={closeReceipt}
              >
                Fermer
              </button>
            </div>

            <div className="modal-body-duu">
              {receiptLoading && (
                <div className="text-muted">Chargement du reçu…</div>
              )}
              {receiptErr && (
                <div className="alert alert-danger">{receiptErr}</div>
              )}

              {!receiptLoading && !receiptErr && receiptOrder && (
                <div className="d-flex flex-wrap gap-3 align-items-start justify-content-between">
                  <div style={{ flex: "1 1 360px" }}>
                    <OrderReceiptTicket
                      order={receiptOrder}
                      logoSrc="/logo.jpeg"
                      slogan="Marketplace & Livraison"
                      hotlinePhone="+212 6 XX XX XX XX"
                      publicWebBase={
                        typeof window !== "undefined"
                          ? window.location.origin
                          : undefined
                      }
                    />
                  </div>

                  <div style={{ flex: "1 1 260px" }}>
                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="fw-bold mb-2">Téléchargement PDF</div>
                        <OrderReceiptButton
                          orderId={receiptOrder.id}
                          className="w-100"
                        />
                        <div className="text-muted small mt-2">
                          Vous pouvez aussi imprimer directement depuis
                          l’aperçu.
                        </div>
                      </div>
                    </div>

                    <div className="alert alert-light border mt-3 mb-0 small">
                      📲 Le QR code permet de vérifier l’authenticité du reçu.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

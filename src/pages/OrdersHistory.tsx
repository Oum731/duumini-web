// src/pages/OrdersHistory.tsx
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
    it.product_cover || // ✅ rempli par l’API /api/orders/:id
    it.image_url ||
    it.cover ||
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
  return it?.product_name || it?.name || `Produit #${it?.product_id ?? ""}`;
}

type ListOrDetail = Order & Partial<OrderDetail>;

/* ===== Helper: construction du message WhatsApp (sans image) ===== */
function buildWhatsappText(opts: {
  order: ListOrDetail;
  items: OrderItem[];
  itemsAmount: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status?: OrderStatus;
}) {
  const { order, items, itemsAmount, deliveryFee, totalAmount, currency, status } =
    opts;

  const anyOrder = order as any;
  const contact = anyOrder.contact || {};
  const address = anyOrder.address || {};

  const created = order?.created_at
    ? new Date(order.created_at).toLocaleString("fr-FR")
    : anyOrder.date
    ? new Date(anyOrder.date).toLocaleString("fr-FR")
    : "";

  // 📝 liste des produits
  const linesText =
    items.length === 0
      ? "- (détails indisponibles)"
      : items
          .map((it) => {
            const name = getItemName(it);
            const qty = Number(it?.qty ?? 1);
            const unit = Number(it?.unit_price ?? (it as any)?.price ?? 0);
            const lineTotal = unit * qty;
            return `* ${name} x${qty} = ${mad(lineTotal)}`;
          })
          .join("\n");

  const contactName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const phone = contact.phone || anyOrder.phone || "";

  const ville = address.ville || anyOrder.address_city || "";
  const commune = address.commune || anyOrder.address_commune || "";
  const quartier = address.quartier || anyOrder.address_district || "";

  const statusLabel = getStatusLabel(status);

  const parts: string[] = [];

  // 🔢 numéro + date
  parts.push(`Bonjour, je souhaite avoir des infos sur ma commande #${order.id}.`);
  if (created) {
    parts.push(`Date de la commande : ${created}`);
  }

  // 📦 produits
  parts.push("");
  parts.push("📦 Récapitulatif de la commande");
  parts.push(linesText);

  // 💰 totaux
  parts.push("");
  parts.push(`Sous-total articles: ${mad(itemsAmount)}`);
  if (deliveryFee > 0) {
    parts.push(`Livraison: ${mad(deliveryFee)}`);
  }
  parts.push(`Total: ${mad(totalAmount)} (${currency})`);

  // 👤 coordonnées
  parts.push("");
  parts.push("👤 Coordonnées");
  if (contactName) parts.push(`Nom: ${contactName}`);
  if (phone) parts.push(`Téléphone: ${phone}`);

  // 📍 adresse
  if (ville || commune || quartier) {
    parts.push("");
    parts.push("📍 Adresse de livraison");
    if (ville) parts.push(`Ville: ${ville}`);
    if (commune) parts.push(`Commune: ${commune}`);
    if (quartier) parts.push(`Quartier: ${quartier}`);
  }

  // ✅ statut actuel
  if (statusLabel) {
    parts.push("");
    parts.push(`Statut actuel: ${statusLabel}`);
  }

  parts.push("");
  parts.push("Merci.");

  return parts.join("\n");
}

/* ===== Helper: URL WhatsApp avec message détaillé ===== */
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
  // Numéro WhatsApp Duumini
  return `https://wa.me/212623677884?text=${text}`;
}

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<ListOrDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [params] = useSearchParams();

  const selectedId = params.get("order") ? Number(params.get("order")) : null;

  /* ---------- Chargement des commandes (sans Promise.allSettled) ---------- */
  const fetchOrders = useCallback(async () => {
    try {
      setErr(null);

      const res = await listOrders({ page: 1, pageSize: 20 });
      const baseList: Order[] = res?.items ?? [];

      const merged: ListOrDetail[] = [];

      // On essaie de charger le détail pour chaque commande,
      // si ça plante, on garde au moins la commande de base
      for (const o of baseList) {
        try {
          const det = await getOrder(o.id);
          merged.push({ ...o, ...det } as ListOrDetail);
        } catch {
          merged.push(o as ListOrDetail);
        }
      }

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
          a?.created_at || (a as any)?.date || 0
        ).getTime();
        const db = new Date(
          b?.created_at || (b as any)?.date || 0
        ).getTime();
        return db - da;
      }),
    [orders]
  );

  async function onCancelOrder(
    id: number,
    status: OrderStatus | string | undefined
  ) {
    const s = (status || "OPEN").toUpperCase() as OrderStatus;
    const canCancel = s === "OPEN" || s === "PREPARATION";
    if (!canCancel) return;

    const ok = window.confirm(
      "Voulez-vous vraiment annuler cette commande ?\n\n" +
        "Vous pouvez annuler tant que la commande n’est pas encore en statut « En livraison »."
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

  if (loading) {
    return (
      <div className="container-xxl py-4">
        <h1 className="h4 mb-3">Mes commandes</h1>
        <div className="text-muted">Chargement…</div>
      </div>
    );
  }

  return (
    <section className="container-xxl py-4">
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
          Vous pouvez annuler votre commande tant qu’elle n’est pas encore en statut{" "}
          <em>En livraison</em>.
        </div>
        <small className="text-muted">
          Une fois la commande passée en livraison, l’annulation n’est plus possible.
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
            const created = o?.created_at
              ? new Date(o.created_at).toLocaleString("fr-FR")
              : "";
            const items: OrderItem[] = Array.isArray((o as any)?.items)
              ? (o as any).items
              : [];

            const totals = (o as any)?.totals as
              | OrderDetail["totals"]
              | undefined;

            const itemsAmount: number =
              totals?.items_amount ??
              items.reduce(
                (sum, it) =>
                  sum +
                  Number(it?.unit_price ?? (it as any)?.price ?? 0) *
                    Number(it?.qty ?? 1),
                0
              );

            const totalAmount =
              typeof (o as any)?.total === "number"
                ? (o as any).total
                : totals?.amount ?? itemsAmount;

            const deliveryFee =
              totals?.delivery_fee ?? Math.max(0, totalAmount - itemsAmount);
            const currency = (
              totals?.currency || (o as any)?.currency || "MAD"
            ).toUpperCase();

            const isHighlighted = selectedId === o.id;

            const status = (o as any)?.status as OrderStatus;
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

            return (
              <div
                key={o.id}
                className={`card border-0 shadow-sm ${
                  isHighlighted ? "border border-dark" : ""
                }`}
              >
                <div className="card-body">
                  {/* En-tête commande */}
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="h6 m-0">Commande #{o.id}</div>
                      {statusBadge(status)}
                    </div>
                    <div className="text-muted small">{created}</div>
                  </div>

                  {/* Articles de la commande */}
                  <h3 className="h6 mt-3 mb-2">Articles de la commande</h3>
                  <ul className="list-group list-group-flush">
                    {items.map((it, idx) => {
                      const name = getItemName(it);
                      const qty = Number(it?.qty ?? 1);
                      const unit = Number(
                        it?.unit_price ?? (it as any)?.price ?? 0
                      );
                      const img = getItemImage(it);
                      const lineTotal = unit * qty;

                      return (
                        <li
                          key={idx}
                          className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                        >
                          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
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
                              <div className="small text-muted">
                                {mad(unit)}{" "}
                                <span className="text-muted">×{qty}</span>
                              </div>
                            </div>
                          </div>

                          {/* Montant total de la ligne, sans débordement */}
                          <div
                            className="fw-semibold text-end"
                            style={{ minWidth: 90, fontSize: "0.9rem" }}
                          >
                            {mad(lineTotal)}
                          </div>
                        </li>
                      );
                    })}

                    {deliveryFee > 0 && (
                      <li className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <span className="text-muted">Livraison</span>
                        <div
                          className="text-end"
                          style={{ minWidth: 90, fontSize: "0.9rem" }}
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
                      style={{ minWidth: 90, textAlign: "right" }}
                    >
                      {mad(itemsAmount)}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div className="text-muted">Total</div>
                    <div
                      className="h6 m-0"
                      style={{ minWidth: 90, textAlign: "right", fontSize: "1rem" }}
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
                      aria-label={`Contacter via WhatsApp pour la commande #${o.id}`}
                    >
                      WhatsApp Support
                    </a>

                    <Link
                      to={`/orders?order=${o.id}`}
                      className="btn btn-outline-dark"
                    >
                      Actualiser l’état
                    </Link>

                    {canCancel && (
                      <button
                        className="btn btn-outline-danger"
                        disabled={cancelingId === o.id}
                        onClick={() => onCancelOrder(o.id, status)}
                        title="Annuler la commande"
                      >
                        {cancelingId === o.id
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
    </section>
  );
}

// src/pages/OrdersHistory.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listOrders,
  getOrder,
  cancelOrder,               // ✅ import annulation
  type Order,
  type OrderDetail,
  type OrderStatus,
  type OrderItem,
} from "../services/orders";
import { mad } from "../store/cart";

/* ===== UI helpers ===== */
function statusBadge(s: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    OPEN: "secondary",
    PREPARATION: "warning",
    DELIVERY: "info",
    DONE: "success",
    CANCELLED: "danger",
  };
  const label: Record<OrderStatus, string> = {
    OPEN: "Ouverte",
    PREPARATION: "Préparation",
    DELIVERY: "En livraison",
    DONE: "Livrée",
    CANCELLED: "Annulée",
  };
  const cls = map[s] || "secondary";
  return <span className={`badge text-bg-${cls}`}>{label[s] || s}</span>;
}

/** Nom de produit robuste */
function getItemName(it: OrderItem): string {
  return it?.product_name || it?.name || `Produit #${it?.product_id ?? ""}`;
}

type ListOrDetail = Order & Partial<OrderDetail>;

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<ListOrDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null); // ✅ état annulation
  const [params] = useSearchParams();

  const selectedId = params.get("order") ? Number(params.get("order")) : null;

  const fetchOrders = useCallback(async () => {
    try {
      setErr(null);

      // 1) liste paginée minimale
      const res = await listOrders({ page: 1, pageSize: 20 });
      const baseList: Order[] = res?.items ?? [];

      // 2) détails de chaque commande (items + totals + address)
      const detailed = await Promise.allSettled(
        baseList.map(async (o) => {
          const det = await getOrder(o.id);
          return { ...o, ...det } as ListOrDetail;
        })
      );

      const ok = detailed
        .filter((p): p is PromiseFulfilledResult<ListOrDetail> => p.status === "fulfilled")
        .map((p) => p.value);

      const fallback = detailed
        .map((p, idx) => (p.status === "rejected" ? baseList[idx] : null))
        .filter(Boolean) as Order[];

      setOrders([...ok, ...fallback]);
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

  const whatsappHref = (orderId: number) => {
    const text = encodeURIComponent(`Bonjour, je souhaite avoir des infos sur ma commande #${orderId}. Merci.`);
    return `https://wa.me/212623677884?text=${text}`;
  };

  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const da = new Date(a?.created_at || (a as any)?.date || 0).getTime();
        const db = new Date(b?.created_at || (b as any)?.date || 0).getTime();
        return db - da;
      }),
    [orders]
  );

  async function onCancelOrder(id: number, status: OrderStatus | string | undefined) {
    // On n'autorise l'annulation que si OPEN ou PREPARATION
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
        <Link to="/" className="btn btn-outline-dark">Continuer mes achats</Link>
      </div>

      {/* ✅ Avertissement annulation avant “En livraison” */}
      <div className="alert alert-warning" role="status" style={{ borderLeft: `4px solid var(--duu-red)` }}>
        <div className="fw-semibold" style={{ color: "var(--duu-black)" }}>
          Vous pouvez annuler votre commande tant qu’elle n’est pas encore en statut <em>En livraison</em>.
        </div>
        <small className="text-muted">
          Une fois la commande passée en livraison, l’annulation n’est plus possible.
        </small>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

      {sorted.length === 0 ? (
        <div className="text-center text-muted py-5">
          <p className="mb-3">Vous n’avez pas encore de commande.</p>
          <Link to="/" className="btn btn-dark">Parcourir les produits</Link>
        </div>
      ) : (
        <div className="vstack gap-3">
          {sorted.map((o) => {
            const created = o?.created_at ? new Date(o.created_at).toLocaleString("fr-FR") : "";
            const items: OrderItem[] = Array.isArray((o as any)?.items) ? (o as any).items : [];

            // Sous-total (unit_price*qty ou price*qty en fallback)
            const itemsAmount: number = items.reduce(
              (sum, it) => sum + Number(it?.unit_price ?? it?.price ?? 0) * Number(it?.qty ?? 1),
              0
            );

            // Totaux depuis l’API si présents, sinon calcul local
            const totals = (o as any)?.totals as OrderDetail["totals"] | undefined;
            const totalAmount =
              typeof (o as any)?.total === "number" ? (o as any).total : totals?.amount ?? itemsAmount;

            const deliveryFee = totals?.delivery_fee ?? Math.max(0, totalAmount - itemsAmount);
            const currency = (totals?.currency || (o as any)?.currency || "MAD").toUpperCase();

            const address: any = (o as any)?.address || {};
            const isHighlighted = selectedId === o.id;

            const status = (o as any)?.status as OrderStatus;
            const canCancel = status === "OPEN" || status === "PREPARATION";

            return (
              <div key={o.id} className={`card border-0 shadow-sm ${isHighlighted ? "border border-dark" : ""}`}>
                <div className="card-body">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="h6 m-0">Commande #{o.id}</div>
                      {statusBadge(status)}
                    </div>
                    <div className="text-muted small">{created}</div>
                  </div>

                  {/* Items : NOMS + MONTANT */}
                  <ul className="list-group list-group-flush mt-2">
                    {items.map((it, idx) => {
                      const name = getItemName(it);
                      const qty = Number(it?.qty ?? 1);
                      const unit = Number(it?.unit_price ?? (it as any)?.price ?? 0);

                      return (
                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                          <div className="text-truncate" title={name}>
                            <span className="fw-semibold">{name}</span>{" "}
                            <span className="text-muted">×{qty}</span>
                          </div>
                          <span className="fw-semibold">{mad(unit * qty)}</span>
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

                  {/* Totaux */}
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted">Sous-total</div>
                    <div className="fw-semibold">{mad(itemsAmount)}</div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="text-muted">Total</div>
                    <div className="h6 m-0">
                      {mad(totalAmount)} <span className="text-muted small">{currency}</span>
                    </div>
                  </div>

                  {/* Adresse & Paiement */}
                  <div className="row g-3 mt-2">
                    <div className="col-12 col-md-6">
                      <div className="small text-muted">Adresse de livraison</div>
                      <div>
                        {address?.city || address?.ville || "-"}
                        {address?.commune ? `, ${address.commune}` : ""}
                        {(address?.district || address?.quartier) ? `, ${address.district ?? address.quartier}` : ""}
                        {address?.gps ? (
                          <>
                            <br />
                            <span className="text-muted">
                              GPS: {address.gps.lat?.toFixed?.(5)}, {address.gps.lng?.toFixed?.(5)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="small text-muted">Paiement</div>
                      <div>
                        {(o as any)?.payment?.method === "COD" ? "À la livraison" : (o as any)?.payment?.method || "-"}
                        {(o as any)?.payment?.note ? (
                          <>
                            <br />
                            <span className="text-muted small">{(o as any).payment.note}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <a
                      href={whatsappHref(o.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success"
                      aria-label={`Contacter via WhatsApp pour la commande #${o.id}`}
                    >
                      WhatsApp Support
                    </a>

                    <Link to={`/orders?order=${o.id}`} className="btn btn-outline-dark">
                      Actualiser l’état
                    </Link>

                    {/* ✅ Bouton annuler : visible seulement si OPEN | PREPARATION */}
                    {canCancel && (
                      <button
                        className="btn btn-outline-danger"
                        disabled={cancelingId === o.id}
                        onClick={() => onCancelOrder(o.id, status)}
                        title="Annuler la commande"
                      >
                        {cancelingId === o.id ? "Annulation…" : "Annuler la commande"}
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

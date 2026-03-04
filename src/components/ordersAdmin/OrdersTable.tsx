// src/components/ordersAdmin/OrdersTable.tsx
import type { Order } from "../../services/orders";
import type { AnyObj, CurrentUser } from "./orderUtils";
import {
  BADGE,
  computeOrderAmounts,
  fulfillmentLabel,
  getOrderDisplayCode,
  getOrderThumb,
  getPaymentLabelForRow,
  getRemainingAmountForRow,
  mad,
  normFulfillment,
  telHref,
} from "./orderUtils";

function safeBadgeForStatus(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN") return BADGE.OPEN;
  if (s === "PREPARATION") return BADGE.PREPARATION;
  if (s === "DELIVERY") return BADGE.DELIVERY;
  if (s === "DONE") return BADGE.DONE;
  if (s === "CANCELLED") return BADGE.CANCELLED;
  return "bg-secondary";
}

export default function OrdersTable(props: {
  loading: boolean;
  orders: Order[];
  user: CurrentUser | null;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onCancel: (id: number) => void;
  onWhatsappClick: (id: number) => void;
  dateTime: (iso?: string) => string;
}) {
  const { loading, orders, onView, onEdit, onCancel, onWhatsappClick, dateTime } = props;

  if (loading) return <div className="text-muted">Chargement…</div>;
  if (!orders.length) return <div className="text-muted">Aucune commande.</div>;

  return (
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

            <th className="text-end">CA (produits)</th>
            <th className="text-end">Livraison/Expédition</th>

            <th className="text-end">Commission (DONE)</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((o) => {
            const anyO = o as AnyObj;

            const c = anyO?.contact || anyO?.user || {};
            const fn = String(c?.first_name || "").trim();
            const ln = String(c?.last_name || "").trim();
            const clientName = fn || ln ? `${fn} ${ln}`.trim() : (String(c?.name || "").trim() || "—");

            const phone = String(c?.phone || "").trim();
            const hrefTel = telHref(phone);

            const thumb = getOrderThumb(anyO);
            const displayCode = getOrderDisplayCode(anyO);

            const { ca, shippingFee, duuShare: duuCommission } = computeOrderAmounts(anyO);

            const payBadge = getPaymentLabelForRow(anyO);
            const remaining = getRemainingAmountForRow(anyO);

            const st = String(o.status || "").toUpperCase();
            const stBadge = safeBadgeForStatus(st);

            const f = normFulfillment(anyO);
            const fBadge = fulfillmentLabel(f);

            return (
              <tr key={o.id}>
                <td style={{ whiteSpace: "nowrap" }}>
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

                <td style={{ whiteSpace: "nowrap" }}>{dateTime(o.created_at)}</td>

                <td className="text-truncate" style={{ maxWidth: 220 }}>
                  {clientName}
                </td>

                <td style={{ minWidth: 170 }}>
                  <div className="d-flex flex-column">
                    <small className="text-muted text-break">{phone || "—"}</small>
                    <div className="d-flex gap-1 mt-1 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => onWhatsappClick(o.id)}
                      >
                        WhatsApp
                      </button>
                      {hrefTel ? (
                        <a className="btn btn-sm btn-outline-dark" href={hrefTel}>
                          Appeler
                        </a>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td>
                  <span className={`badge ${stBadge}`}>{st || "—"}</span>
                </td>

                <td>
                  <span className={`badge ${fBadge.cls}`}>{fBadge.text}</span>
                </td>

                <td>
                  <span className={`badge ${payBadge.cls}`}>{payBadge.text}</span>
                </td>

                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                  {remaining == null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="fw-semibold">{mad(remaining)}</span>
                  )}
                </td>

                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                  {mad(ca)}
                </td>

                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                  {shippingFee > 0 ? mad(shippingFee) : <span className="text-muted">—</span>}
                </td>

                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                  {st === "DONE" ? (
                    <span className="fw-semibold">{mad(duuCommission)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                <td className="text-end" style={{ whiteSpace: "nowrap" }}>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => onView(o.id)}>
                      Voir
                    </button>
                    <button className="btn btn-sm btn-outline-dark" onClick={() => onEdit(o.id)}>
                      Modifier
                    </button>

                    {st !== "CANCELLED" && st !== "DONE" && (
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
  );
}
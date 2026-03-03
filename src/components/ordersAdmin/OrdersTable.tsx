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

            {/* ✅ séparations */}
            <th className="text-end">CA (produits)</th>
            <th className="text-end">Livraison/Expédition</th>

            <th className="text-end">Commission (DONE)</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((o) => {
            const c = (o as any)?.contact || (o as any)?.user || {};
            const fn = (c?.first_name || "").trim();
            const ln = (c?.last_name || "").trim();
            const clientName = fn || ln ? `${fn} ${ln}`.trim() : "—";
            const phone = (c?.phone || "").trim();
            const hrefTel = telHref(phone);

            const thumb = getOrderThumb(o as AnyObj);
            const displayCode = getOrderDisplayCode(o);

            const {
              ca, // ✅ CA produits (hors livraison)
              shippingFee, // ✅ livraison/expédition
              duuShare: duuCommission,
            } = computeOrderAmounts(o as AnyObj);

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
                  <span className={`badge ${BADGE[o.status]}`}>{o.status}</span>
                </td>

                <td>
                  <span className={`badge ${fBadge.cls}`}>{fBadge.text}</span>
                </td>

                <td>
                  <span className={`badge ${payBadge.cls}`}>{payBadge.text}</span>
                </td>

                <td className="text-end">
                  {remaining == null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="fw-semibold">{mad(remaining)}</span>
                  )}
                </td>

                {/* ✅ CA produits */}
                <td className="text-end">{mad(ca)}</td>

                {/* ✅ Livraison/Expédition séparée */}
                <td className="text-end">{shippingFee > 0 ? mad(shippingFee) : <span className="text-muted">—</span>}</td>

                <td className="text-end">
                  {st === "DONE" ? (
                    <span className="fw-semibold">{mad(duuCommission)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
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
  );
}
// src/components/ordersAdmin/OrderViewModal.tsx
import { useMemo } from "react";
import type { OrderStatus } from "../../services/orders";
import type { AnyObj, PayStatus } from "./orderUtils";
import {
  BADGE,
  STATUSES,
  computeOrderAmounts,
  computePayStatus,
  computeRemaining,
  fromInputNumberValue,
  fulfillmentLabel,
  getItemImage,
  getOrderDisplayCode,
  getPaymentFromOrder,
  mad,
  normFulfillment,
  telHref,
  toInputNumberValue,
  waHref,
} from "./orderUtils";
import OrderReceipt from "./OrderReceipt";
import { useAuth } from "../../context/AuthContext";

const FRONT_ALLOWED_PHONES = ["+212665255698", "+212662325586"];

function normalizePhone(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    return `+${cleaned.slice(1).replace(/\D/g, "")}`;
  }

  return cleaned.replace(/\D/g, "");
}

function getAuthUserPhone(user: any) {
  return (
    user?.phone ||
    user?.telephone ||
    user?.user_phone ||
    user?.contact?.phone ||
    user?.profile?.phone ||
    user?.admin?.phone ||
    ""
  );
}


export default function OrderViewModal(props: {
  open: boolean;
  viewId: number | null;
  detail: AnyObj | null;
  loading: boolean;
  error: string | null;

  viewStatus: OrderStatus;
  setViewStatus: (s: OrderStatus) => void;

  saving: boolean;
  onClose: () => void;

  onConfirmQuick: (s: OrderStatus) => void;
  onSaveStatus: () => void;

  updatePaymentAvailable: boolean;
  payEditMode: "SET" | "ADD";
  setPayEditMode: (m: "SET" | "ADD") => void;
  payInput: number;
  setPayInput: (n: number) => void;
  payMethod: string;
  setPayMethod: (s: string) => void;
  payNote: string;
  setPayNote: (s: string) => void;
  paySaving: boolean;
  onSavePayment: () => void;

  onCancel: (id: number) => void;

  dateTime: (iso?: string) => string;
}) {
  const {
    open,
    viewId,
    detail,
    loading,
    error,
    viewStatus,
    setViewStatus,
    saving,
    onClose,
    onConfirmQuick,
    onSaveStatus,
    updatePaymentAvailable,
    payEditMode,
    setPayEditMode,
    payInput,
    setPayInput,
    payMethod,
    setPayMethod,
    payNote,
    setPayNote,
    paySaving,
    onSavePayment,
    onCancel,
    dateTime,
  } = props;

  const auth = useAuth() as any;
  const currentUser = auth?.user || auth?.currentUser || auth?.admin || null;

  const currentUserPhone = normalizePhone(getAuthUserPhone(currentUser));
  const canModifyFromFront = FRONT_ALLOWED_PHONES
    .map(normalizePhone)
    .includes(currentUserPhone);

  if (!open || viewId == null) return null;

  const viewDisplayCode =
    viewId !== null
      ? detail
        ? getOrderDisplayCode(detail as AnyObj)
        : getOrderDisplayCode(viewId)
      : "";

  const client = (() => {
    const d = detail || {};
    const c = (d as any).contact || (d as any).user || d;
    const first_name = c?.first_name ?? "";
    const last_name = c?.last_name ?? "";
    const phone = c?.phone ?? c?.user_phone ?? "";
    const fullName =
      `${(first_name || "").trim()} ${(last_name || "").trim()}`.trim() || "—";
    return { first_name, last_name, fullName, phone };
  })();

  const address = (detail?.address as AnyObj) || {};
  const itemsDetail: AnyObj[] = Array.isArray(detail?.items)
    ? (detail as any).items
    : [];

  const viewFulfillment = useMemo(
    () => (detail ? normFulfillment(detail) : "DELIVERY"),
    [detail]
  );
  const viewFulLabel = useMemo(
    () => fulfillmentLabel(viewFulfillment),
    [viewFulfillment]
  );

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
    const status: PayStatus = (pay?.status || derived) as any;

    return { ...pay, total, remaining, status };
  }, [detail]);

  const { itemsAmount, deliveryFee, total } = useMemo(() => {
    if (!detail) return { itemsAmount: 0, deliveryFee: 0, total: 0 };
    return computeOrderAmounts(detail);
  }, [detail]);

  const wrapText: React.CSSProperties = {
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };

  const modificationLockMessage =
    "Vous n’êtes pas autorisé à modifier cette commande depuis cette interface.";

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: "rgba(0,0,0,.45)" }}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered"
        role="document"
      >
        <div
          className="modal-content border-0 shadow-lg"
          style={{ borderRadius: 16, overflow: "hidden" }}
        >
          <div className="modal-header align-items-start">
            <div className="d-flex flex-column" style={{ minWidth: 0 }}>
              <h5 className="modal-title mb-1" style={wrapText}>
                Commande #{viewDisplayCode}
              </h5>

              {detail ? (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span
                    className={`badge ${
                      BADGE[((detail as AnyObj).status as OrderStatus) || "OPEN"]
                    }`}
                  >
                    {(detail as AnyObj).status}
                  </span>
                  <span className={`badge ${viewFulLabel.cls}`}>
                    {viewFulLabel.text}
                  </span>
                  <span className="text-muted small" style={wrapText}>
                    {dateTime((detail as AnyObj).created_at)}
                  </span>
                </div>
              ) : null}
            </div>

            <button className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            {!canModifyFromFront ? (
              <div className="alert alert-warning mb-3" style={wrapText}>
                {modificationLockMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="text-muted">Chargement…</div>
            ) : error ? (
              <div className="alert alert-danger" style={wrapText}>
                {error}
              </div>
            ) : !detail ? (
              <div className="text-muted">Aucun détail.</div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body">
                    <div className="d-flex flex-column flex-lg-row gap-2 justify-content-between align-items-stretch align-items-lg-center">
                      <div
                        className="btn-group flex-wrap"
                        role="group"
                        aria-label="Quick status"
                      >
                        <button
                          className="btn btn-sm btn-outline-dark"
                          disabled={
                            !canModifyFromFront ||
                            saving ||
                            (detail as AnyObj).status !== "OPEN"
                          }
                          onClick={() => {
                            if (!canModifyFromFront) return;
                            onConfirmQuick("PREPARATION");
                          }}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : "Confirmer = passer en préparation"
                          }
                        >
                          Confirmer
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          disabled={
                            !canModifyFromFront ||
                            saving ||
                            (detail as AnyObj).status !== "PREPARATION"
                          }
                          onClick={() => {
                            if (!canModifyFromFront) return;
                            onConfirmQuick("DELIVERY");
                          }}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : "Mettre en livraison"
                          }
                        >
                          En livraison
                        </button>
                        <button
                          className="btn btn-sm btn-outline-success"
                          disabled={
                            !canModifyFromFront ||
                            saving ||
                            (detail as AnyObj).status === "DONE" ||
                            (detail as AnyObj).status === "CANCELLED"
                          }
                          onClick={() => {
                            if (!canModifyFromFront) return;
                            onConfirmQuick("DONE");
                          }}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : "Marquer comme livrée"
                          }
                        >
                          Livrée
                        </button>
                      </div>

                      <div className="d-flex flex-wrap gap-2 justify-content-end">
                        <select
                          className="form-select form-select-sm"
                          value={viewStatus}
                          onChange={(e) =>
                            canModifyFromFront &&
                            setViewStatus(e.target.value as OrderStatus)
                          }
                          style={{ width: 200 }}
                          disabled={!canModifyFromFront || saving}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : undefined
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <button
                          className="btn btn-sm btn-dark"
                          disabled={!canModifyFromFront || saving}
                          onClick={() => {
                            if (!canModifyFromFront) return;
                            onSaveStatus();
                          }}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : undefined
                          }
                        >
                          {saving ? "…" : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-lg-5">
                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div style={{ minWidth: 0 }}>
                            <div className="text-muted small mb-1">Client</div>
                            <div className="fw-semibold" style={wrapText}>
                              {client.fullName}
                            </div>
                            <div className="text-muted small" style={wrapText}>
                              {client.phone || "—"}
                            </div>
                          </div>

                          <div className="d-flex flex-wrap gap-2 justify-content-end">
                            <a
                              className="btn btn-sm btn-success"
                              href={waHref(detail as AnyObj)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              WhatsApp
                            </a>
                            {client.phone ? (
                              <a
                                className="btn btn-sm btn-outline-dark"
                                href={telHref(client.phone)}
                              >
                                Appeler
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {viewFulfillment === "DELIVERY" ? (
                      <div className="card border-0 shadow-sm mb-3">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div style={{ minWidth: 0 }}>
                              <div className="text-muted small mb-1">
                                Adresse de livraison
                              </div>
                              <div style={wrapText}>
                                {address?.city || address?.ville || "—"}
                                {address?.commune ? `, ${address.commune}` : ""}
                                {address?.district || address?.quartier
                                  ? `, ${address.district ?? address.quartier}`
                                  : ""}
                              </div>

                              {address?.gps ? (
                                <div
                                  className="text-muted small mt-2"
                                  style={wrapText}
                                >
                                  GPS: {address.gps.lat?.toFixed?.(5)},{" "}
                                  {address.gps.lng?.toFixed?.(5)}
                                </div>
                              ) : null}
                            </div>

                            {(detail as AnyObj)?.geo_link ? (
                              <a
                                className="btn btn-sm btn-outline-secondary"
                                href={(detail as AnyObj).geo_link}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Maps
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card border-0 shadow-sm mb-3">
                        <div className="card-body">
                          <div className="text-muted small mb-1">Réception</div>
                          {viewFulfillment === "PICKUP" ? (
                            <div className="text-muted small" style={wrapText}>
                              Récupération sur place.
                            </div>
                          ) : (
                            <div className="text-muted small" style={wrapText}>
                              Expédition : dépôt Duumini. Le client paie le
                              transporteur au retrait.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mb-3">
                      <OrderReceipt order={detail as AnyObj} />
                    </div>

                    <div className="card border-0 shadow-sm">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="d-flex align-items-center gap-2">
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
                        </div>

                        {viewPay ? (
                          <>
                            <div className="row g-2 small">
                              <div className="col-6">
                                <div className="text-muted">Sous-total</div>
                                <div className="fw-semibold" style={wrapText}>
                                  {mad(itemsAmount)}
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted">Livraison</div>
                                <div className="fw-semibold" style={wrapText}>
                                  {mad(deliveryFee)}
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted">Total</div>
                                <div className="fw-semibold" style={wrapText}>
                                  {mad(total)}
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted">Payé</div>
                                <div className="fw-semibold" style={wrapText}>
                                  {mad(viewPay.paid_amount)}
                                </div>
                              </div>
                              <div className="col-12">
                                <div className="text-muted">Reste</div>
                                <div className="fw-semibold" style={wrapText}>
                                  {viewPay.remaining == null ? (
                                    <span className="text-muted">—</span>
                                  ) : (
                                    mad(viewPay.remaining)
                                  )}
                                </div>
                              </div>
                            </div>

                            {(viewPay.method || viewPay.note) && (
                              <div
                                className="small text-muted mt-2"
                                style={wrapText}
                              >
                                {viewPay.method ? (
                                  <div style={wrapText}>
                                    Méthode: {String(viewPay.method)}
                                  </div>
                                ) : null}
                                {viewPay.note ? (
                                  <div style={wrapText}>
                                    Note: {String(viewPay.note)}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {updatePaymentAvailable ? (
                              <div className="mt-3">
                                {!canModifyFromFront ? (
                                  <div
                                    className="alert alert-light border small mb-2"
                                    style={wrapText}
                                  >
                                    Modification du paiement verrouillée pour ce
                                    compte.
                                  </div>
                                ) : null}

                                <div className="row g-2">
                                  <div className="col-12 col-md-4">
                                    <select
                                      className="form-select form-select-sm"
                                      value={payEditMode}
                                      onChange={(e) =>
                                        canModifyFromFront &&
                                        setPayEditMode(e.target.value as any)
                                      }
                                      disabled={!canModifyFromFront || paySaving}
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
                                      placeholder={
                                        payEditMode === "ADD"
                                          ? "Montant à ajouter"
                                          : "Montant payé"
                                      }
                                      value={toInputNumberValue(payInput)}
                                      onChange={(e) =>
                                        canModifyFromFront &&
                                        setPayInput(
                                          fromInputNumberValue(e.target.value)
                                        )
                                      }
                                      disabled={!canModifyFromFront || paySaving}
                                    />
                                  </div>

                                  <div className="col-12 col-md-4">
                                    <input
                                      className="form-control form-control-sm"
                                      placeholder="Méthode (CASH, VIREMENT...)"
                                      value={payMethod}
                                      onChange={(e) =>
                                        canModifyFromFront &&
                                        setPayMethod(e.target.value)
                                      }
                                      disabled={!canModifyFromFront || paySaving}
                                      style={wrapText}
                                    />
                                  </div>

                                  <div className="col-12">
                                    <input
                                      className="form-control form-control-sm"
                                      placeholder="Note (optionnel)"
                                      value={payNote}
                                      onChange={(e) =>
                                        canModifyFromFront &&
                                        setPayNote(e.target.value)
                                      }
                                      disabled={!canModifyFromFront || paySaving}
                                      style={wrapText}
                                    />
                                  </div>
                                </div>

                                <div className="d-flex justify-content-end mt-2">
                                  <button
                                    className="btn btn-sm btn-dark"
                                    onClick={() => {
                                      if (!canModifyFromFront) return;
                                      onSavePayment();
                                    }}
                                    disabled={!canModifyFromFront || paySaving}
                                    title={
                                      !canModifyFromFront
                                        ? modificationLockMessage
                                        : undefined
                                    }
                                  >
                                    {paySaving ? "…" : "Mettre à jour paiement"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="text-muted small">
                            Paiement non disponible.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-lg-7">
                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Articles</h6>
                          <div className="text-muted small" style={wrapText}>
                            {itemsDetail.length} item(s)
                          </div>
                        </div>

                        <ul className="list-group list-group-flush">
                          {itemsDetail.map((it, i) => {
                            const name =
                              it?.product_name ||
                              it?.name ||
                              `Produit #${it?.product_id ?? ""}`;
                            const qty = Number(it?.qty ?? 1);
                            const unit = Number(it?.unit_price ?? it?.price ?? 0);
                            const img = getItemImage(it);
                            const lineTotal = unit * qty;

                            return (
                              <li key={i} className="list-group-item py-2">
                                <div className="d-flex gap-2 align-items-start">
                                  {img ? (
                                    <div
                                      style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        background: "#f5f5f5",
                                        flex: "0 0 auto",
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

                                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="fw-semibold" style={wrapText}>
                                      {name}
                                    </div>

                                    <div className="small text-muted d-flex flex-wrap gap-2">
                                      <span style={wrapText}>{mad(unit)}</span>
                                      <span className="text-muted">×{qty}</span>
                                    </div>
                                  </div>

                                  <div className="text-end" style={{ flex: "0 0 auto" }}>
                                    <div className="fw-semibold" style={wrapText}>
                                      {mad(lineTotal)}
                                    </div>
                                  </div>
                                </div>
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
                        <div className="d-flex justify-content-between align-items-center mt-1">
                          <div className="text-muted">Total</div>
                          <div className="h6 m-0">{mad(total)}</div>
                        </div>
                      </div>
                    </div>

                    {(detail as AnyObj)?.status !== "CANCELLED" &&
                    (detail as AnyObj)?.status !== "DONE" ? (
                      <div className="d-flex justify-content-end mt-3">
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => {
                            if (!canModifyFromFront) return;
                            onCancel(viewId);
                          }}
                          disabled={!canModifyFromFront || saving}
                          title={
                            !canModifyFromFront
                              ? modificationLockMessage
                              : undefined
                          }
                        >
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
            <button className="btn btn-outline-dark" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
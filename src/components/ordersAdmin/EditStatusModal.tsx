// src/components/ordersAdmin/EditStatusModal.tsx
import type { OrderStatus } from "../../services/orders";
import { STATUSES } from "./orderUtils";

export default function EditStatusModal(props: {
  open: boolean;
  title: string;
  status: OrderStatus;
  setStatus: (s: OrderStatus) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { open, title, status, setStatus, saving, onClose, onSave } = props;
  if (!open) return null;

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ background: "rgba(0,0,0,.35)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title text-truncate" style={{ maxWidth: "80%" }}>
              {title}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          <div className="modal-body">
            <label className="form-label">Statut</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              disabled={saving}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="text-muted small mt-2" style={{ lineHeight: 1.35 }}>
              Astuce : <span className="fw-semibold">DONE</span> signifie livrée/terminée.{" "}
              <span className="fw-semibold">CANCELLED</span> annule définitivement la commande.
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-dark" disabled={saving} onClick={onClose}>
              Fermer
            </button>
            <button className="btn btn-dark" disabled={saving} onClick={onSave}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
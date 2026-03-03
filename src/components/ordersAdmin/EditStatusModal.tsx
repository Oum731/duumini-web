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
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: "rgba(0,0,0,.2)" }}>
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={onClose} />
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
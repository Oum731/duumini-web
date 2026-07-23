// src/components/ordersAdmin/OrdersFiltersBar.tsx
import type { OrderStatus } from "../../services/orders";
import type { PayStatus } from "./orderUtils";
import { STATUSES } from "./orderUtils";

export default function OrdersFiltersBar(props: {
  q: string;
  setQ: (v: string) => void;
  statusFilter: "ALL" | OrderStatus;
  setStatusFilter: (v: "ALL" | OrderStatus) => void;
  payFilter: "ALL" | PayStatus;
  setPayFilter: (v: "ALL" | PayStatus) => void;
  loading: boolean;
  refresh: () => void;
  page: number;
  pages: number;
  total: number;
  onResetPage: () => void;
}) {
  const {
    q,
    setQ,
    statusFilter,
    setStatusFilter,
    payFilter,
    setPayFilter,
    loading,
    refresh,
    page,
    pages,
    total,
    onResetPage,
  } = props;

  return (
    <div
      className="card border-0 mb-3"
      style={{ borderRadius: "var(--duu-radius-lg)", boxShadow: "var(--duu-shadow-sm)" }}
    >
      <div className="card-body p-3 p-sm-4 d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            placeholder="Recherche (#, statut, client, téléphone...)"
            value={q}
            onChange={(e) => {
              onResetPage();
              setQ(e.target.value);
            }}
            style={{ maxWidth: 420 }}
          />

          <select
            className="form-select"
            style={{ width: 190 }}
            value={statusFilter}
            onChange={(e) => {
              onResetPage();
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
              onResetPage();
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
          Page {page}/{pages} • {total} commande(s)
        </div>
      </div>
    </div>
  );
}
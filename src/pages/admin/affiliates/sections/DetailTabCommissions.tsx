import { DUU, formatDate, formatMoney, statusBadgeClass, type PageInfo } from "../shared";
import { PaginationBar } from "../components";
import { getCommissionAmount, getCommissionBase } from "../helpers";
import type { AffiliateCommission, CommissionStatus } from "../types";

export function DetailTabCommissions({
  commissionStatusFilter,
  commissionItems,
  commissionPageInfo,
  onStatusFilterChange,
  onChangeStatus,
  onPageChange,
}: {
  commissionStatusFilter: string;
  commissionItems: AffiliateCommission[];
  commissionPageInfo: PageInfo;
  onStatusFilterChange: (value: string) => void;
  onChangeStatus: (row: AffiliateCommission, status: CommissionStatus) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <div className="mb-3">
        <label className="form-label small fw-semibold">
          Filtrer les commissions
        </label>
        <select
          className="form-select form-select-sm"
          style={{ borderRadius: 12, borderColor: DUU.line }}
          value={commissionStatusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="">Tous</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      <div className="d-flex flex-column gap-2">
        {commissionItems.length === 0 ? (
          <div className="small" style={{ color: DUU.gray }}>
            Aucune commission.
          </div>
        ) : (
          commissionItems.map((row) => (
            <div
              key={row.id}
              className="p-3"
              style={{
                borderRadius: 18,
                border: `1px solid ${DUU.line}`,
                background: DUU.white,
              }}
            >
              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <div className="fw-semibold" style={{ color: DUU.black }}>
                    Commission #{row.id}
                  </div>
                  <div className="small" style={{ color: DUU.gray }}>
                    Commande: {row.order_id ?? "-"}
                  </div>
                </div>

                <span
                  className="px-3 py-2 d-inline-flex"
                  style={{
                    borderRadius: 999,
                    fontSize: ".78rem",
                    fontWeight: 800,
                    ...statusBadgeClass(row.status),
                  }}
                >
                  {row.status}
                </span>
              </div>

              <div className="small mb-3" style={{ color: DUU.black }}>
                <div>Base: {formatMoney(getCommissionBase(row))}</div>
                <div>Montant: {formatMoney(getCommissionAmount(row))}</div>
                <div>Rate: {Number(row.commission_rate || 0)}%</div>
                <div>Produit: {row.product_id ?? "-"}</div>
                <div>Jour: {row.period_day || "-"}</div>
                <div>Mois: {row.period_month || "-"}</div>
                <div>Créé le: {formatDate(row.created_at)}</div>
                <div>Payé le: {formatDate(row.paid_at)}</div>
              </div>

              <select
                className="form-select form-select-sm"
                style={{ borderRadius: 12, borderColor: DUU.line }}
                value={row.status}
                onChange={(e) =>
                  onChangeStatus(row, e.target.value as CommissionStatus)
                }
              >
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          ))
        )}
      </div>

      <PaginationBar pageInfo={commissionPageInfo} onChange={onPageChange} />
    </>
  );
}

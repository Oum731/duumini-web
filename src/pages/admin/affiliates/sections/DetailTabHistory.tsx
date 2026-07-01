import type { RevenuePeriod, AffiliateRevenueHistoryRow } from "../../../../services/affiliates";
import { DUU, formatDateOnly, formatMoney, formatNumber, type PageInfo } from "../shared";
import { HistoryStat, PaginationBar } from "../components";

export function DetailTabHistory({
  historyPeriod,
  historyItems,
  historyPageInfo,
  onPeriodChange,
  onPageChange,
}: {
  historyPeriod: RevenuePeriod;
  historyItems: AffiliateRevenueHistoryRow[];
  historyPageInfo: PageInfo;
  onPeriodChange: (period: RevenuePeriod) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <div className="mb-3">
        <label className="form-label small fw-semibold">
          Période historique
        </label>
        <select
          className="form-select form-select-sm"
          style={{ borderRadius: 12, borderColor: DUU.line }}
          value={historyPeriod}
          onChange={(e) => onPeriodChange(e.target.value as RevenuePeriod)}
        >
          <option value="DAY">Jour</option>
          <option value="WEEK">Semaine</option>
          <option value="MONTH">Mois</option>
          <option value="YEAR">Année</option>
        </select>
      </div>

      <div className="d-flex flex-column gap-2">
        {historyItems.length === 0 ? (
          <div className="small" style={{ color: DUU.gray }}>
            Aucun historique disponible.
          </div>
        ) : (
          historyItems.map((row, idx) => (
            <div
              key={`${row.period_key}-${idx}`}
              className="p-3"
              style={{
                borderRadius: 20,
                border: `1px solid ${DUU.line}`,
                background: DUU.white,
              }}
            >
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <div className="fw-bold" style={{ color: DUU.black }}>
                    {row.period_key || "-"}
                  </div>
                  <div className="small" style={{ color: DUU.gray }}>
                    {formatDateOnly(row.period_start)} → {formatDateOnly(row.period_end)}
                  </div>
                </div>
                <div className="fw-bold" style={{ color: DUU.black, fontSize: "1.05rem" }}>
                  {formatMoney(row.commission_total || 0)}
                </div>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <HistoryStat label="Commandes" value={formatNumber(row.orders_count || 0)} />
                </div>
                <div className="col-6">
                  <HistoryStat label="Ventes" value={formatMoney(row.sales_amount || 0)} />
                </div>
                <div className="col-6">
                  <HistoryStat
                    label="En attente"
                    value={formatMoney(row.commission_pending || 0)}
                    tone="warning"
                  />
                </div>
                <div className="col-6">
                  <HistoryStat
                    label="Payé"
                    value={formatMoney(row.commission_paid || 0)}
                    tone="success"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <PaginationBar pageInfo={historyPageInfo} onChange={onPageChange} />
    </>
  );
}

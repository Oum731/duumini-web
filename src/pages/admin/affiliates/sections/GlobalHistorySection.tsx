import { History } from "lucide-react";
import type { RevenuePeriod, AffiliateRevenueHistoryRow } from "../../../../services/affiliates";
import { DUU, cardStyle, formatMoney, formatNumber, formatDateOnly, type PageInfo } from "../shared";
import { SectionTitle, InlineHistoryMetrics, PaginationBar } from "../components";

export function GlobalHistorySection({
  globalHistoryPeriod,
  globalHistoryItems,
  globalHistoryPageInfo,
  onPeriodChange,
  onPageChange,
}: {
  globalHistoryPeriod: RevenuePeriod;
  globalHistoryItems: AffiliateRevenueHistoryRow[];
  globalHistoryPageInfo: PageInfo;
  onPeriodChange: (period: RevenuePeriod) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mb-4 p-3 p-lg-4" style={cardStyle()}>
      <SectionTitle
        icon={<History size={20} />}
        title="Historique global des revenus affiliés"
        sub="Consulte les jours, semaines, mois ou années précédents"
      />

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4 col-lg-3">
          <label className="form-label fw-semibold">Période historique</label>
          <select
            className="form-select"
            style={{ borderRadius: 16, borderColor: DUU.line, minHeight: 48 }}
            value={globalHistoryPeriod}
            onChange={(e) => onPeriodChange(e.target.value as RevenuePeriod)}
          >
            <option value="DAY">Jour</option>
            <option value="WEEK">Semaine</option>
            <option value="MONTH">Mois</option>
            <option value="YEAR">Année</option>
          </select>
        </div>
      </div>

      <div className="row g-3">
        {globalHistoryItems.length === 0 ? (
          <div className="col-12">
            <div className="small" style={{ color: DUU.gray }}>
              Aucun historique global disponible.
            </div>
          </div>
        ) : (
          globalHistoryItems.map((row, idx) => (
            <div className="col-12" key={`${row.period_key}-${idx}`}>
              <div
                className="p-3 h-100"
                style={{
                  borderRadius: 20,
                  border: `1px solid ${DUU.line}`,
                  background: DUU.white,
                }}
              >
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="fw-bold" style={{ color: DUU.black, fontSize: "1rem" }}>
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

                <InlineHistoryMetrics
                  clicks={formatNumber(row.clicks_count || 0)}
                  orders={formatNumber(row.orders_count || 0)}
                  sales={formatMoney(row.sales_amount || 0)}
                  pending={formatMoney(row.commission_pending || 0)}
                  paid={formatMoney(row.commission_paid || 0)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3">
        <PaginationBar
          pageInfo={globalHistoryPageInfo}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
}

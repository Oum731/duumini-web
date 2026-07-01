import { BadgePercent, BarChart3, Copy, MousePointerClick, Percent, TrendingUp, Wallet } from "lucide-react";
import type { RevenuePeriod, AffiliateDashboardResponse, AffiliateRevenueHistoryRow } from "../../../../services/affiliates";
import { DUU, cardStyle, formatMoney, formatNumber, statusBadgeClass, type PageInfo, type ProductOption } from "../shared";
import { SectionTitle, KpiCard } from "../components";
import { safeAffiliateName } from "../helpers";
import type { Affiliate, AffiliateCommission, AffiliateClick, CommissionStatus } from "../types";
import { ProductLinkGenerator } from "./ProductLinkGenerator";
import { DetailTabOverview } from "./DetailTabOverview";
import { DetailTabCommissions } from "./DetailTabCommissions";
import { DetailTabClicks } from "./DetailTabClicks";
import { DetailTabHistory } from "./DetailTabHistory";

export type DetailTab = "overview" | "commissions" | "clicks" | "history";

export function AffiliateDetailDrawer({
  selectedId,
  detailLoading,
  selectedAffiliate,
  affiliateDashboard,
  todayGain,
  weekGain,
  monthGain,
  yearGain,
  selectedPublicByCode,
  selectedPublicBySlug,
  selectedTrackingUrl,
  productSearch,
  selectedProductId,
  productsLoading,
  filteredProducts,
  selectedProduct,
  selectedProductPath,
  selectedProductPublicUrl,
  selectedProductTrackingUrl,
  onProductSearchChange,
  onProductSelect,
  detailTab,
  onTabChange,
  commissionStatusFilter,
  commissionItems,
  commissionPageInfo,
  onCommissionStatusFilterChange,
  onChangeCommissionStatus,
  onCommissionPageChange,
  clickItems,
  clickPageInfo,
  onClickPageChange,
  historyPeriod,
  historyItems,
  historyPageInfo,
  onHistoryPeriodChange,
  onHistoryPageChange,
  onCopy,
}: {
  selectedId: number | null;
  detailLoading: boolean;
  selectedAffiliate: Affiliate | null;
  affiliateDashboard: AffiliateDashboardResponse | null;
  todayGain: number;
  weekGain: number;
  monthGain: number;
  yearGain: number;
  selectedPublicByCode: string;
  selectedPublicBySlug: string;
  selectedTrackingUrl: string;
  productSearch: string;
  selectedProductId: number | "";
  productsLoading: boolean;
  filteredProducts: ProductOption[];
  selectedProduct: ProductOption | null;
  selectedProductPath: string;
  selectedProductPublicUrl: string;
  selectedProductTrackingUrl: string;
  onProductSearchChange: (value: string) => void;
  onProductSelect: (id: number | "") => void;
  detailTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  commissionStatusFilter: string;
  commissionItems: AffiliateCommission[];
  commissionPageInfo: PageInfo;
  onCommissionStatusFilterChange: (value: string) => void;
  onChangeCommissionStatus: (row: AffiliateCommission, status: CommissionStatus) => void;
  onCommissionPageChange: (page: number) => void;
  clickItems: AffiliateClick[];
  clickPageInfo: PageInfo;
  onClickPageChange: (page: number) => void;
  historyPeriod: RevenuePeriod;
  historyItems: AffiliateRevenueHistoryRow[];
  historyPageInfo: PageInfo;
  onHistoryPeriodChange: (period: RevenuePeriod) => void;
  onHistoryPageChange: (page: number) => void;
  onCopy: (text: string | null | undefined, label: string) => void;
}) {
  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Vue" },
    { key: "commissions", label: "Commissions" },
    { key: "clicks", label: "Clics" },
    { key: "history", label: "Historique" },
  ];

  return (
    <div style={cardStyle({ minHeight: "100%" })}>
      <div className="p-3 p-lg-4 border-bottom" style={{ borderColor: DUU.line }}>
        <SectionTitle
          icon={<BadgePercent size={20} />}
          title="Panneau affilié"
          sub="Détail, liens, commissions, clics et historique"
          right={
            selectedAffiliate ? (
              <span
                className="px-3 py-2 d-inline-flex"
                style={{
                  borderRadius: 999,
                  fontSize: ".82rem",
                  fontWeight: 800,
                  ...statusBadgeClass(selectedAffiliate.status),
                }}
              >
                {selectedAffiliate.status}
              </span>
            ) : null
          }
        />
      </div>

      <div className="p-3 p-lg-4">
        {!selectedId ? (
          <div style={{ color: DUU.gray }}>
            Sélectionne un affilié dans la liste pour voir ses performances détaillées.
          </div>
        ) : detailLoading ? (
          <div style={{ color: DUU.gray }}>Chargement...</div>
        ) : !selectedAffiliate ? (
          <div className="text-danger">Impossible de charger le détail.</div>
        ) : (
          <>
            <div className="mb-3">
              <div className="fw-bold fs-5" style={{ color: DUU.black }}>
                {safeAffiliateName(selectedAffiliate)}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Code: {selectedAffiliate.affiliate_code || "-"}
              </div>
              <div className="small" style={{ color: DUU.gray }}>
                Slug: {selectedAffiliate.referral_slug || "-"}
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <KpiCard
                  title="Clics"
                  value={formatNumber(selectedAffiliate.total_clicks)}
                  icon={<MousePointerClick size={18} />}
                />
              </div>
              <div className="col-6">
                <KpiCard
                  title="Commandes"
                  value={formatNumber(selectedAffiliate.total_orders)}
                  icon={<BarChart3 size={18} />}
                />
              </div>
              <div className="col-12">
                <KpiCard
                  title="Total gains"
                  value={formatMoney(selectedAffiliate.total_earnings)}
                  hint={`Taux ${selectedAffiliate.commission_rate}%`}
                  icon={<Percent size={18} />}
                />
              </div>
            </div>

            {affiliateDashboard ? (
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <KpiCard
                    title="Gain du jour"
                    value={formatMoney(todayGain)}
                    icon={<Wallet size={18} />}
                  />
                </div>
                <div className="col-6">
                  <KpiCard
                    title="Gain semaine"
                    value={formatMoney(weekGain)}
                    icon={<TrendingUp size={18} />}
                  />
                </div>
                <div className="col-6">
                  <KpiCard
                    title="Gain mois"
                    value={formatMoney(monthGain)}
                    icon={<BarChart3 size={18} />}
                  />
                </div>
                <div className="col-6">
                  <KpiCard
                    title="Gain année"
                    value={formatMoney(yearGain)}
                    icon={<Percent size={18} />}
                  />
                </div>
              </div>
            ) : null}

            <div className="mb-3">
              <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                Téléphone
              </div>
              <div style={{ color: DUU.black }}>
                {selectedAffiliate.phone || selectedAffiliate.user?.phone || "-"}
              </div>
            </div>

            <div className="mb-3">
              <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                Utilisateur lié
              </div>
              <div style={{ color: DUU.black }}>
                {selectedAffiliate.user ? (
                  <>
                    #{selectedAffiliate.user.id}{" "}
                    {selectedAffiliate.user.first_name || ""}{" "}
                    {selectedAffiliate.user.last_name || ""}
                    {selectedAffiliate.user.role
                      ? ` — ${selectedAffiliate.user.role}`
                      : ""}
                  </>
                ) : (
                  "-"
                )}
              </div>
            </div>

            <div className="mb-3">
              <div className="small fw-semibold mb-1" style={{ color: DUU.gray }}>
                Notes
              </div>
              <div style={{ color: DUU.black }}>{selectedAffiliate.notes || "-"}</div>
            </div>

            <div className="mb-4">
              <div className="small fw-semibold mb-2" style={{ color: DUU.gray }}>
                Liens
              </div>

              <div className="d-grid gap-2">
                <button
                  type="button"
                  className="btn text-start"
                  style={{
                    background: DUU.white,
                    color: DUU.black,
                    border: `1px solid ${DUU.line}`,
                    borderRadius: 14,
                    fontWeight: 700,
                  }}
                  onClick={() => onCopy(selectedPublicByCode, "Lien public code")}
                >
                  <Copy size={15} className="me-2" />
                  Copier lien site affilié
                </button>

                <button
                  type="button"
                  className="btn text-start"
                  style={{
                    background: DUU.white,
                    color: DUU.black,
                    border: `1px solid ${DUU.line}`,
                    borderRadius: 14,
                    fontWeight: 700,
                  }}
                  onClick={() => onCopy(selectedPublicBySlug, "Lien public slug")}
                >
                  <Copy size={15} className="me-2" />
                  Copier lien site slug
                </button>

                <button
                  type="button"
                  className="btn text-start"
                  style={{
                    background: DUU.yellowSoft,
                    color: DUU.black,
                    border: `1px solid ${DUU.yellowBorder}`,
                    borderRadius: 14,
                    fontWeight: 800,
                  }}
                  onClick={() => onCopy(selectedTrackingUrl, "Lien tracking site")}
                >
                  <Copy size={15} className="me-2" />
                  Copier lien tracking site
                </button>
              </div>
            </div>

            <ProductLinkGenerator
              productSearch={productSearch}
              selectedProductId={selectedProductId}
              productsLoading={productsLoading}
              filteredProducts={filteredProducts}
              selectedProduct={selectedProduct}
              selectedProductPath={selectedProductPath}
              selectedProductPublicUrl={selectedProductPublicUrl}
              selectedProductTrackingUrl={selectedProductTrackingUrl}
              onSearchChange={onProductSearchChange}
              onProductSelect={onProductSelect}
              onCopy={onCopy}
            />

            <div className="d-flex gap-2 mb-3">
              {tabs.map((tab) => {
                const active = detailTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className="btn flex-fill"
                    style={{
                      borderRadius: 14,
                      background: active ? DUU.black : DUU.white,
                      color: active ? DUU.yellow : DUU.black,
                      border: `1px solid ${active ? DUU.black : DUU.line}`,
                      fontWeight: 800,
                    }}
                    onClick={() => onTabChange(tab.key)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {detailTab === "overview" ? (
              <DetailTabOverview selectedAffiliate={selectedAffiliate} />
            ) : null}

            {detailTab === "commissions" ? (
              <DetailTabCommissions
                commissionStatusFilter={commissionStatusFilter}
                commissionItems={commissionItems}
                commissionPageInfo={commissionPageInfo}
                onStatusFilterChange={onCommissionStatusFilterChange}
                onChangeStatus={onChangeCommissionStatus}
                onPageChange={onCommissionPageChange}
              />
            ) : null}

            {detailTab === "clicks" ? (
              <DetailTabClicks
                clickItems={clickItems}
                clickPageInfo={clickPageInfo}
                onPageChange={onClickPageChange}
              />
            ) : null}

            {detailTab === "history" ? (
              <DetailTabHistory
                historyPeriod={historyPeriod}
                historyItems={historyItems}
                historyPageInfo={historyPageInfo}
                onPeriodChange={onHistoryPeriodChange}
                onPageChange={onHistoryPageChange}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

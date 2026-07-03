import { BadgePercent, BarChart3, TrendingUp, UserRound, Wallet } from "lucide-react";
import type { RevenuePeriod } from "../../../../services/affiliates";
import { DUU, cardStyle, formatMoney, formatNumber } from "../shared";
import { KpiCard } from "../components";
import { periodLabel } from "../helpers";

export function HeroHeader({
  error,
  success,
  globalPeriod,
  globalMetrics,
  totals,
}: {
  error: string;
  success: string;
  globalPeriod: RevenuePeriod;
  globalMetrics: {
    orders_count: number;
    sales_amount: number;
    commission_total: number;
    clicks_count: number;
  };
  totals: { affiliates: number; active: number };
}) {
  return (
    <>
      <div
        className="mb-4 p-4 p-lg-5"
        style={cardStyle({
          background:
            "radial-gradient(circle at top right, rgba(245,130,31,0.28), transparent 35%), linear-gradient(135deg, #111111 0%, #1B1B1B 100%)",
          border: "1px solid rgba(245,130,31,0.16)",
        })}
      >
        <div className="row g-4 align-items-center">
          <div className="col-12 col-xl-8">
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-2 mb-3"
              style={{
                borderRadius: 999,
                background: "rgba(245,130,31,0.14)",
                color: DUU.yellow,
                border: "1px solid rgba(245,130,31,0.24)",
                fontWeight: 700,
                fontSize: ".9rem",
              }}
            >
              <BadgePercent size={16} />
              Réseau d’affiliation Duumini
            </div>

            <h2 className="fw-bold mb-2" style={{ color: DUU.white, fontSize: "2rem" }}>
              Dashboard affiliés pro
            </h2>

            <p
              className="mb-0"
              style={{ color: "rgba(255,255,255,0.72)", maxWidth: 760 }}
            >
              Pilote la création, la performance, les liens de partage, les clics
              trackés, les commissions et l’historique des revenus de tes affiliés
              depuis une seule page.
            </p>
          </div>

          <div className="col-12 col-xl-4">
            <div
              className="p-3 p-lg-4"
              style={{
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div className="small mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                Aperçu global {periodLabel(globalPeriod)}
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Commandes affiliées</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatNumber(globalMetrics.orders_count)}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Ventes affiliées</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatMoney(globalMetrics.sales_amount)}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center pt-2">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Gains affiliés</span>
                <strong style={{ color: DUU.yellow }}>
                  {formatMoney(globalMetrics.commission_total)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {success ? <div className="alert alert-success py-2">{success}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Affiliés visibles"
            value={formatNumber(totals.affiliates)}
            hint="Selon les filtres actuels"
            icon={<UserRound size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Affiliés actifs"
            value={formatNumber(totals.active)}
            hint="Actifs sur la page courante"
            icon={<TrendingUp size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title={`Revenu global ${periodLabel(globalPeriod)}`}
            value={formatMoney(globalMetrics.commission_total)}
            hint={`${formatNumber(globalMetrics.orders_count)} commande(s)`}
            icon={<Wallet size={20} />}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Ventes affiliées"
            value={formatMoney(globalMetrics.sales_amount)}
            hint={`${formatNumber(globalMetrics.clicks_count)} clic(s)`}
            icon={<BarChart3 size={20} />}
          />
        </div>
      </div>
    </>
  );
}

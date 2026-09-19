// src/pages/admin/WeeklyReportPage.tsx
//
// Phase D : Compte-rendu (jour/semaine/mois/année) — reproduit dans l'app
// l'onglet "CR Hebdo" du classeur de gestion existant (résultats clés de
// la période), automatisé au lieu d'être rempli à la main.
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Wallet, AlertTriangle, Boxes, ClipboardList, Percent, Trophy } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { getWeeklyReport, type WeeklyReport, type ReportType } from "../../services/reports";

const PERIOD_LABEL: Record<ReportType, string> = {
  DAILY: "Jour",
  WEEKLY: "Semaine",
  MONTHLY: "Mois",
  YEARLY: "Année",
};

const PRODUCTS_PAGE_SIZE = 20;

export default function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState("");
  const [periodType, setPeriodType] = useState<ReportType>("WEEKLY");
  const [page, setPage] = useState(1);

  const pages = useMemo(
    () => Math.max(1, Math.ceil((report?.products.pageInfo.total ?? 0) / PRODUCTS_PAGE_SIZE)),
    [report]
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWeeklyReport({
        periodType,
        anchorDate: anchorDate || undefined,
        page,
        pageSize: PRODUCTS_PAGE_SIZE,
      });
      setReport(res);
    } catch (e: any) {
      const msg = e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger le compte-rendu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [periodType, anchorDate]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, anchorDate, page]);

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });

  return (
    <div>
      <PageHeader
        title="Compte-rendu"
        subtitle={
          report
            ? `${PERIOD_LABEL[report.period.type]} du ${fmtDate(report.period.start)} au ${fmtDate(report.period.end)}`
            : "Résultats clés de la période, en un coup d'œil."
        }
        right={
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as ReportType)}
            >
              {(Object.keys(PERIOD_LABEL) as ReportType[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="form-control form-control-sm"
              style={{ maxWidth: 170 }}
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              title="Consulter une autre période"
            />
          </div>
        }
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading || !report ? (
        <LoadingState label="Chargement du compte-rendu..." />
      ) : (
        <>
          <h6 className="text-muted text-uppercase small fw-bold mt-2 mb-2">Ventes de la période</h6>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={TrendingUp} label="Chiffre d'affaires" value={moneyMAD(report.sales.total_amount)} accent="blue" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={ClipboardList} label="Commandes" value={report.sales.orders_count} accent="neutral" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={Percent} label="Commission Duumini" value={moneyMAD(report.sales.duumini_commission)} accent="green" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={Wallet} label="Dépenses" value={moneyMAD(report.expenses.total)} accent="orange" />
            </div>
          </div>

          {report.top_product ? (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body d-flex align-items-center gap-3">
                <div
                  className="rounded-circle bg-warning bg-opacity-25 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 48, height: 48 }}
                >
                  <Trophy size={22} className="text-warning" />
                </div>
                <div>
                  <div className="text-muted small text-uppercase fw-bold">Produit le plus vendu</div>
                  <div className="fw-semibold">{report.top_product.name}</div>
                  <div className="small text-muted">
                    {report.top_product.total_qty} vendu(s) — {moneyMAD(report.top_product.total_amount)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <h6 className="text-muted text-uppercase small fw-bold mb-2">Situation globale</h6>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={AlertTriangle} label="Créances clients" value={moneyMAD(report.debts.total_due)} accent="orange" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={Boxes} label="Valeur du stock" value={moneyMAD(report.stock.total_value)} accent="blue" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={AlertTriangle} label="Produits sous seuil" value={report.stock.low_count} accent="orange" />
            </div>
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={ClipboardList} label="Actions en retard" value={report.operations.late_count} accent="orange" />
            </div>
          </div>

          <h6 className="text-muted text-uppercase small fw-bold mb-2">État de chaque produit</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="text-end">Entrées</th>
                  <th className="text-end">Sorties</th>
                  <th className="text-end">Stock (pièces)</th>
                  <th className="text-end">Stock (cartons)</th>
                  <th className="text-end">Valeur</th>
                  <th className="text-end">CMP</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {report.products.items.map((p) => (
                  <tr key={p.product_id} className={p.status === "ALERTE" ? "table-warning" : ""}>
                    <td>{p.name}</td>
                    <td className="text-end text-success">{p.entries}</td>
                    <td className="text-end text-danger">{p.exits}</td>
                    <td className="text-end fw-semibold">{p.stock_qty}</td>
                    <td className="text-end">{p.stock_cartons ?? "—"}</td>
                    <td className="text-end">{p.value != null ? moneyMAD(p.value) : "—"}</td>
                    <td className="text-end text-muted">{p.cmp != null ? moneyMAD(p.cmp) : "—"}</td>
                    <td>
                      <span className={`badge ${p.status === "ALERTE" ? "bg-danger" : "bg-success"}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {report.products.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      Aucun produit.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {report.products.items.length > 0 ? (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted small">{report.products.pageInfo.total} produit(s)</div>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-dark" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Préc.
                </button>
                <span className="btn btn-sm btn-outline-dark disabled">
                  {page} / {pages}
                </span>
                <button className="btn btn-sm btn-outline-dark" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Suiv.
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

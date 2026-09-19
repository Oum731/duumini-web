// src/pages/admin/WeeklyReportPage.tsx
//
// Phase D : Compte-rendu hebdomadaire — reproduit dans l'app l'onglet
// "CR Hebdo" du classeur de gestion existant (résultats clés de la
// semaine), automatisé au lieu d'être rempli à la main chaque vendredi.
import { useEffect, useState } from "react";
import { TrendingUp, Wallet, AlertTriangle, Boxes, ClipboardList, Percent } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import { getWeeklyReport, type WeeklyReport } from "../../services/reports";

export default function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await getWeeklyReport(anchorDate || undefined);
      setReport(res);
    } catch (e: any) {
      const msg = e?.payload?.error || e?.data?.error || e?.message || "Impossible de charger le compte-rendu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate]);

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });

  return (
    <div>
      <PageHeader
        title="Compte-rendu hebdomadaire"
        subtitle={
          report
            ? `Semaine du ${fmtDate(report.period.start)} au ${fmtDate(report.period.end)}`
            : "Résultats clés de la semaine, en un coup d'œil."
        }
        right={
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ maxWidth: 170 }}
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            title="Consulter une autre semaine"
          />
        }
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading || !report ? (
        <LoadingState label="Chargement du compte-rendu..." />
      ) : (
        <>
          <h6 className="text-muted text-uppercase small fw-bold mt-2 mb-2">Ventes de la semaine</h6>
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

          <h6 className="text-muted text-uppercase small fw-bold mb-2">Operations en cours</h6>
          <div className="row g-3">
            <div className="col-sm-6 col-lg-3">
              <KpiCard icon={ClipboardList} label="Actions ouvertes" value={report.operations.open_count} accent="neutral" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

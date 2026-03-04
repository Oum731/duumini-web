import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSalesReport, type SalesReport } from "../../services/reports";

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (String(iso).length <= 10) return d.toLocaleDateString("fr-FR");
  return d.toLocaleString("fr-FR");
}

function safeErrorMessage(e: any) {
  return e?.response?.data?.error || e?.message || "Erreur";
}

export default function ReportSalesViewPage() {
  const { id } = useParams();
  const reportId = Number(id);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!Number.isFinite(reportId) || reportId <= 0) {
      setError("ID invalide");
      setReport(null);
      return;
    }

    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await getSalesReport(reportId);
        if (!mounted) return;
        setReport(r || null);
      } catch (e: any) {
        if (!mounted) return;
        setReport(null);
        setError(safeErrorMessage(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [reportId]);

  const title = useMemo(() => {
    if (!report) return "Rapport";
    return `Rapport ${report.period_type} (${report.currency})`;
  }, [report]);

  const onPrint = () => window.print();

  const onShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(url);
      alert("Lien copié !");
    } catch {
      alert(url);
    }
  };

  const payloadForView = useMemo(() => {
    if (!report) return null;
    return (report as any)?.data ?? report;
  }, [report]);

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h2 className="mb-0">{title}</h2>
          <div className="text-muted small">
            <span className="me-2">
              <b>Période:</b> {fmt(report?.period_start)} → {fmt(report?.period_end)}
            </span>
            <span>
              <b>ID:</b> #{report?.id ?? "—"}
            </span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/reports/sales">
            Retour
          </Link>
          <button className="btn btn-outline-dark" onClick={onShare} disabled={!report}>
            Partager
          </button>
          <button className="btn btn-primary" onClick={onPrint} disabled={!report}>
            Imprimer
          </button>
        </div>
      </div>

      {loading && <div className="text-muted">Chargement…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!!report && (
        <div ref={printRef} className="card">
          <div className="card-body">
            <div className="mb-3">
              <div className="row g-2">
                <div className="col-12 col-md-3">
                  <div className="small text-muted">Type</div>
                  <div className="fw-semibold">{report.period_type}</div>
                </div>
                <div className="col-12 col-md-3">
                  <div className="small text-muted">Devise</div>
                  <div className="fw-semibold">{report.currency}</div>
                </div>
                <div className="col-12 col-md-3">
                  <div className="small text-muted">Créé</div>
                  <div className="fw-semibold">{fmt(report.created_at || undefined)}</div>
                </div>
                <div className="col-12 col-md-3">
                  <div className="small text-muted">Mis à jour</div>
                  <div className="fw-semibold">{fmt(report.updated_at || undefined)}</div>
                </div>
              </div>
            </div>

            <h5 className="mb-2">Données</h5>
            <pre
              className="bg-light p-3 rounded small mb-0"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {JSON.stringify(payloadForView, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
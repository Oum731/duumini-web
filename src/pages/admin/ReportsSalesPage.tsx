import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listSalesReports,
  type ReportType,
  type SalesReport,
} from "../../services/reports";

const TYPES: ReportType[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (String(iso).length <= 10) return d.toLocaleDateString("fr-FR");
  return d.toLocaleString("fr-FR");
}

function safeErrorMessage(e: any) {
  return e?.response?.data?.error || e?.message || "Erreur";
}

export default function ReportsSalesPage() {
  const [type, setType] = useState<ReportType>("DAILY");
  const [currency, setCurrency] = useState("MAD");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SalesReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({
      type,
      currency,
      from: from || undefined,
      to: to || undefined,
    }),
    [type, currency, from, to],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await listSalesReports(queryParams);
        if (!mounted) return;
        setItems(r?.items ?? []);
      } catch (e: any) {
        if (!mounted) return;
        setItems([]);
        setError(safeErrorMessage(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [queryParams]);

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h2 className="mb-0">Rapports de ventes</h2>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-3">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label">Devise</label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="MAD">MAD</option>
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label">Du</label>
              <input
                className="form-control"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label">Au</label>
              <input
                className="form-control"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-1 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="text-muted">Chargement…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !items.length && !error && (
        <div className="text-muted">Aucun rapport.</div>
      )}

      {!!items.length && (
        <div className="card">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Période</th>
                  <th>Devise</th>
                  <th>Créé</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>
                      <span className="badge text-bg-dark">{r.period_type}</span>
                    </td>
                    <td>
                      <div className="small">
                        <div>
                          <b>Début:</b> {fmtDate(r.period_start)}
                        </div>
                        <div>
                          <b>Fin:</b> {fmtDate(r.period_end)}
                        </div>
                      </div>
                    </td>
                    <td>{r.currency}</td>
                    <td>{fmtDate(r.created_at || undefined)}</td>
                    <td className="text-end">
                      <Link
                        className="btn btn-sm btn-primary"
                        to={`/admin/reports/sales/${r.id}`}
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
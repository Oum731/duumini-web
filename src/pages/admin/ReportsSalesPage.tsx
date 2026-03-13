import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listSalesReports,
  type ReportType,
  type SalesReport,
} from "../../services/reports";

const TYPES: ReportType[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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

function toSqlStart(dateStr: string) {
  return `${dateStr} 00:00:00`;
}

function toSqlEnd(dateStr: string) {
  return `${dateStr} 23:59:59`;
}

function getDateFromWeekValue(weekValue: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!m) return null;

  const year = Number(m[1]);
  const week = Number(m[2]);

  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function formatDateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getMonthRange(monthValue: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);

  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getYearRange(yearValue: string) {
  const year = Number(yearValue);
  if (!Number.isFinite(year) || year <= 0) return null;

  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function buildQueryParams(args: {
  type: ReportType;
  currency: string;
  fromDay: string;
  toDay: string;
  fromWeek: string;
  toWeek: string;
  fromMonth: string;
  toMonth: string;
  fromYear: string;
  toYear: string;
}) {
  const {
    type,
    currency,
    fromDay,
    toDay,
    fromWeek,
    toWeek,
    fromMonth,
    toMonth,
    fromYear,
    toYear,
  } = args;

  let from: string | undefined;
  let to: string | undefined;

  if (type === "DAILY") {
    if (fromDay) from = toSqlStart(fromDay);
    if (toDay) to = toSqlEnd(toDay);
  }

  if (type === "WEEKLY") {
    if (fromWeek) {
      const r = getDateFromWeekValue(fromWeek);
      if (r) from = toSqlStart(formatDateOnly(r.start));
    }
    if (toWeek) {
      const r = getDateFromWeekValue(toWeek);
      if (r) to = toSqlEnd(formatDateOnly(r.end));
    }
  }

  if (type === "MONTHLY") {
    if (fromMonth) {
      const r = getMonthRange(fromMonth);
      if (r) from = toSqlStart(formatDateOnly(r.start));
    }
    if (toMonth) {
      const r = getMonthRange(toMonth);
      if (r) to = toSqlEnd(formatDateOnly(r.end));
    }
  }

  if (type === "YEARLY") {
    if (fromYear) {
      const r = getYearRange(fromYear);
      if (r) from = toSqlStart(r.start);
    }
    if (toYear) {
      const r = getYearRange(toYear);
      if (r) to = toSqlEnd(r.end);
    }
  }

  return {
    type,
    currency,
    from,
    to,
  };
}

export default function ReportsSalesPage() {
  const [type, setType] = useState<ReportType>("DAILY");
  const [currency, setCurrency] = useState("MAD");

  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");

  const [fromWeek, setFromWeek] = useState("");
  const [toWeek, setToWeek] = useState("");

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SalesReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    return buildQueryParams({
      type,
      currency,
      fromDay,
      toDay,
      fromWeek,
      toWeek,
      fromMonth,
      toMonth,
      fromYear,
      toYear,
    });
  }, [
    type,
    currency,
    fromDay,
    toDay,
    fromWeek,
    toWeek,
    fromMonth,
    toMonth,
    fromYear,
    toYear,
  ]);

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

  function resetFilters() {
    setFromDay("");
    setToDay("");
    setFromWeek("");
    setToWeek("");
    setFromMonth("");
    setToMonth("");
    setFromYear("");
    setToYear("");
  }

  function renderPeriodFilters() {
    if (type === "DAILY") {
      return (
        <>
          <div className="col-12 col-md-3">
            <label className="form-label">Du</label>
            <input
              className="form-control"
              type="date"
              value={fromDay}
              onChange={(e) => setFromDay(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label">Au</label>
            <input
              className="form-control"
              type="date"
              value={toDay}
              onChange={(e) => setToDay(e.target.value)}
            />
          </div>
        </>
      );
    }

    if (type === "WEEKLY") {
      return (
        <>
          <div className="col-12 col-md-3">
            <label className="form-label">Semaine de début</label>
            <input
              className="form-control"
              type="week"
              value={fromWeek}
              onChange={(e) => setFromWeek(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label">Semaine de fin</label>
            <input
              className="form-control"
              type="week"
              value={toWeek}
              onChange={(e) => setToWeek(e.target.value)}
            />
          </div>
        </>
      );
    }

    if (type === "MONTHLY") {
      return (
        <>
          <div className="col-12 col-md-3">
            <label className="form-label">Mois de début</label>
            <input
              className="form-control"
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label">Mois de fin</label>
            <input
              className="form-control"
              type="month"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="col-12 col-md-3">
          <label className="form-label">Année de début</label>
          <input
            className="form-control"
            type="number"
            min="2000"
            max="2100"
            step="1"
            placeholder="2026"
            value={fromYear}
            onChange={(e) => setFromYear(e.target.value)}
          />
        </div>

        <div className="col-12 col-md-3">
          <label className="form-label">Année de fin</label>
          <input
            className="form-control"
            type="number"
            min="2000"
            max="2100"
            step="1"
            placeholder="2026"
            value={toYear}
            onChange={(e) => setToYear(e.target.value)}
          />
        </div>
      </>
    );
  }

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
                    {t === "DAILY"
                      ? "Jour"
                      : t === "WEEKLY"
                        ? "Semaine"
                        : t === "MONTHLY"
                          ? "Mois"
                          : "Année"}
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

            {renderPeriodFilters()}

            <div className="col-12 col-md-1 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={resetFilters}
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
                      <span className="badge text-bg-dark">
                        {r.period_type === "DAILY"
                          ? "Jour"
                          : r.period_type === "WEEKLY"
                            ? "Semaine"
                            : r.period_type === "MONTHLY"
                              ? "Mois"
                              : "Année"}
                      </span>
                    </td>
                    <td>
                      <div className="small">
                        <div>
                          <b>Début :</b> {fmtDate(r.period_start)}
                        </div>
                        <div>
                          <b>Fin :</b> {fmtDate(r.period_end)}
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
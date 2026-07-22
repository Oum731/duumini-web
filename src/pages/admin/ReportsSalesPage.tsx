import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../../components/ui/Spinner";
import {
  listSalesReports,
  parseSalesReportDetails,
  type ReportType,
  type SalesReport,
} from "../../services/reports";

const TYPES: ReportType[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";

  const raw = String(value).trim();
  if (!raw) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const dt = new Date(normalized);

  if (Number.isNaN(dt.getTime())) return raw;

  return dt.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtMoney(value?: number | string | null, currency = "MAD") {
  const n = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "MAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function safeErrorMessage(e: any) {
  return e?.response?.data?.error || e?.message || "Erreur";
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

function typeLabel(t?: ReportType | string) {
  if (t === "DAILY") return "Jour";
  if (t === "WEEKLY") return "Semaine";
  if (t === "MONTHLY") return "Mois";
  if (t === "YEARLY") return "Année";
  return String(t || "—");
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
    if (fromDay) from = fromDay;
    if (toDay) to = toDay;
  }

  if (type === "WEEKLY") {
    if (fromWeek) {
      const r = getDateFromWeekValue(fromWeek);
      if (r) from = formatDateOnly(r.start);
    }

    if (toWeek) {
      const r = getDateFromWeekValue(toWeek);
      if (r) to = formatDateOnly(r.end);
    }
  }

  if (type === "MONTHLY") {
    if (fromMonth) {
      const r = getMonthRange(fromMonth);
      if (r) from = formatDateOnly(r.start);
    }

    if (toMonth) {
      const r = getMonthRange(toMonth);
      if (r) to = formatDateOnly(r.end);
    }
  }

  if (type === "YEARLY") {
    if (fromYear) {
      const r = getYearRange(fromYear);
      if (r) from = r.start;
    }

    if (toYear) {
      const r = getYearRange(toYear);
      if (r) to = r.end;
    }
  }

  return {
    type,
    currency,
    from,
    to,
  };
}

function sumBy<T>(items: T[], getter: (x: T) => number) {
  return items.reduce((acc, item) => acc + getter(item), 0);
}

function pickFirstFiniteNumber(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeReportRow(r: SalesReport) {
  const details = parseSalesReportDetails(r.details_json) || {};

  const grossItemsAmount = Math.max(
    0,
    pickFirstFiniteNumber(
      details.gross_items_amount,
      details.net_items_amount && details.admin_discount_amount !== undefined
        ? Number(details.net_items_amount) + Number(details.admin_discount_amount || 0)
        : null
    ) ?? 0
  );

  const adminDiscountAmount = Math.max(
    0,
    pickFirstFiniteNumber(details.admin_discount_amount, 0) ?? 0
  );

  const netItemsAmount = Math.max(
    0,
    pickFirstFiniteNumber(
      details.net_items_amount,
      r.items_amount,
      r.total_amount,
      0
    ) ?? 0
  );

  const deliveryAmount = Math.max(
    0,
    pickFirstFiniteNumber(r.delivery_amount, 0) ?? 0
  );

  const totalSalesAmount = Math.max(
    0,
    pickFirstFiniteNumber(r.total_amount, netItemsAmount, 0) ?? 0
  );

  const paidAmount = Math.max(
    0,
    pickFirstFiniteNumber(details.paid_amount, 0) ?? 0
  );

  const remainingAmount = Math.max(
    0,
    pickFirstFiniteNumber(
      details.remaining_amount,
      Math.max(0, totalSalesAmount - paidAmount)
    ) ?? 0
  );

  const commissionAmount = Math.max(
    0,
    pickFirstFiniteNumber(r.duumini_commission, 0) ?? 0
  );

  const paymentBreakdown = Array.isArray(details.payment_breakdown)
    ? details.payment_breakdown
    : [];

  return {
    ...r,
    _details: details,
    _gross_items_amount: grossItemsAmount,
    _admin_discount_amount: adminDiscountAmount,
    _net_items_amount: netItemsAmount,
    _delivery_amount: deliveryAmount,
    _total_sales_amount: totalSalesAmount,
    _paid_amount: paidAmount,
    _remaining_amount: remainingAmount,
    _commission_amount: commissionAmount,
    _payment_breakdown: paymentBreakdown,
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

  useEffect(() => {
    resetFilters();
  }, [type]);

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

        const nextItems = Array.isArray(r?.items) ? r.items : [];
        const safeTypedItems = nextItems.filter((x) => x.period_type === type);

        setItems(safeTypedItems);
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
  }, [queryParams, type]);

  const enrichedItems = useMemo(() => {
    return items.map(normalizeReportRow);
  }, [items]);

  const summary = useMemo(() => {
    const reportsCount = enrichedItems.length;

    const ordersCount = sumBy(enrichedItems, (x: any) =>
      toNumber(x.orders_count || 0)
    );

    const grossItemsAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._gross_items_amount)
    );

    const adminDiscountAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._admin_discount_amount)
    );

    const netItemsAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._net_items_amount)
    );

    const deliveryAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._delivery_amount)
    );

    const totalAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._total_sales_amount)
    );

    const commissionAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._commission_amount)
    );

    const paidAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._paid_amount)
    );

    const remainingAmount = sumBy(
      enrichedItems,
      (x: any) => toNumber(x._remaining_amount)
    );

    return {
      reportsCount,
      ordersCount,
      grossItemsAmount,
      adminDiscountAmount,
      netItemsAmount,
      deliveryAmount,
      totalAmount,
      commissionAmount,
      paidAmount,
      remainingAmount,
    };
  }, [enrichedItems]);

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
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h2 className="mb-1 fw-bold">Dashboard rapports de ventes</h2>
          <div className="text-muted small">
            Vue synthétique des performances Duumini
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
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
                    {typeLabel(t)}
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

      {loading && <LoadingState />}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Nombre de rapports</div>
                  <div className="fs-3 fw-bold">{summary.reportsCount}</div>
                  <div className="small text-muted mt-1">
                    Type sélectionné : {typeLabel(type)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Nombre de commandes</div>
                  <div className="fs-3 fw-bold">{summary.ordersCount}</div>
                  <div className="small text-muted mt-1">
                    Total cumulé sur la période filtrée
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Total ventes</div>
                  <div className="fs-3 fw-bold">
                    {fmtMoney(summary.totalAmount, currency)}
                  </div>
                  <div className="small text-muted mt-1">
                    Produits nets (hors livraison)
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Commission Duumini</div>
                  <div className="fs-3 fw-bold">
                    {fmtMoney(summary.commissionAmount, currency)}
                  </div>
                  <div className="small text-muted mt-1">
                    Basée sur les produits nets
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">CA brut produits</div>
                  <div className="fs-4 fw-bold">
                    {fmtMoney(summary.grossItemsAmount, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Réduction admin</div>
                  <div className="fs-4 fw-bold text-danger">
                    {fmtMoney(summary.adminDiscountAmount, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Produits nets</div>
                  <div className="fs-4 fw-bold">
                    {fmtMoney(summary.netItemsAmount, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 col-xl-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Livraison</div>
                  <div className="fs-4 fw-bold">
                    {fmtMoney(summary.deliveryAmount, currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Montant payé</div>
                  <div className="fs-3 fw-bold text-success">
                    {fmtMoney(summary.paidAmount, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="text-muted small mb-1">Reste à payer</div>
                  <div className="fs-3 fw-bold text-warning">
                    {fmtMoney(summary.remainingAmount, currency)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !items.length && !error && (
        <div className="text-muted">Aucun rapport.</div>
      )}

      {!!enrichedItems.length && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0 pb-0">
            <h5 className="mb-0 fw-semibold">Liste détaillée des rapports</h5>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Période</th>
                  <th className="text-end">Cmdes</th>
                  <th className="text-end">Brut</th>
                  <th className="text-end">Réduc.</th>
                  <th className="text-end">Produits nets</th>
                  <th className="text-end">Livraison</th>
                  <th className="text-end">Total ventes</th>
                  <th className="text-end">Payé</th>
                  <th className="text-end">Reste</th>
                  <th className="text-end">Commission</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {enrichedItems.map((r: any) => (
                  <tr key={r.id}>
                    <td className="fw-semibold">#{r.id}</td>
                    <td>
                      <span className="badge text-bg-dark">
                        {typeLabel(r.period_type)}
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
                    <td className="text-end">{toNumber(r.orders_count)}</td>
                    <td className="text-end">
                      {fmtMoney(r._gross_items_amount, r.currency)}
                    </td>
                    <td className="text-end text-danger">
                      {fmtMoney(r._admin_discount_amount, r.currency)}
                    </td>
                    <td className="text-end fw-semibold">
                      {fmtMoney(r._net_items_amount, r.currency)}
                    </td>
                    <td className="text-end">
                      {fmtMoney(r._delivery_amount, r.currency)}
                    </td>
                    <td className="text-end fw-semibold">
                      {fmtMoney(r._total_sales_amount, r.currency)}
                    </td>
                    <td className="text-end text-success">
                      {fmtMoney(r._paid_amount, r.currency)}
                    </td>
                    <td className="text-end text-warning">
                      {fmtMoney(r._remaining_amount, r.currency)}
                    </td>
                    <td className="text-end">
                      {fmtMoney(r._commission_amount, r.currency)}
                    </td>
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
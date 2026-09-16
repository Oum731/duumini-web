// src/pages/admin/CourierTripsAdminPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Bike, Wallet, Clock3, CheckCircle2 } from "lucide-react";
import { LoadingState } from "../../components/ui/Spinner";
import { PageHeader, KpiCard } from "../../components/admin/adminUI";
import { moneyMAD } from "../../utils/money";
import {
  listAllCourierTrips,
  getCourierTripsSummary,
  setCourierTripCommissionStatus,
  courierTripErrorMessage,
  type CourierTrip,
  type TripStatus,
  type CommissionStatus,
  type CourierTripsSummary,
} from "../../services/courierTrips";

const STATUS_LABEL: Record<TripStatus, string> = {
  REQUESTED: "En attente",
  ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const STATUS_BADGE: Record<TripStatus, string> = {
  REQUESTED: "bg-warning text-dark",
  ACCEPTED: "bg-info text-dark",
  IN_PROGRESS: "bg-primary",
  DELIVERED: "bg-success",
  CANCELLED: "bg-secondary",
};

const TRIPS_PAGE_SIZE = 30;

export default function CourierTripsAdminPage() {
  const [items, setItems] = useState<CourierTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TripStatus | "">("");
  const [countryFilter, setCountryFilter] = useState<"" | "MA" | "CI">("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<CourierTripsSummary | null>(null);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / TRIPS_PAGE_SIZE)), [total]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listAllCourierTrips({
        status: statusFilter || undefined,
        country_code: countryFilter || undefined,
        page,
        pageSize: TRIPS_PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.pageInfo.total);
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de charger les courses."));
    } finally {
      setLoading(false);
    }
  }

  // ✅ KPI calculés côté serveur sur TOUTES les courses correspondant aux
  // filtres (pas seulement la page affichée) — sinon "Commission à régler"
  // etc. ne refléterait qu'une fraction du total dès qu'il y a plus d'une
  // page de résultats.
  async function refreshSummary() {
    try {
      const res = await getCourierTripsSummary({
        status: statusFilter || undefined,
        country_code: countryFilter || undefined,
      });
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [statusFilter, countryFilter]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, countryFilter, page]);

  useEffect(() => {
    refreshSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, countryFilter]);

  async function handleToggleCommission(id: number, current: CommissionStatus) {
    setBusyId(id);
    try {
      await setCourierTripCommissionStatus(id, current === "PAID" ? "PENDING" : "PAID");
      await refresh();
      await refreshSummary();
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de mettre à jour la commission."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container-xxl py-4">
      <PageHeader title="Courses livreur" subtitle={`${total} course(s)`} />

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <KpiCard icon={Bike} label="Courses livrées" value={summary?.delivered_count ?? 0} accent="green" />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard
            icon={Clock3}
            label="Commission à régler"
            value={moneyMAD(summary?.commission_pending ?? 0, 2)}
            accent="orange"
          />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard
            icon={CheckCircle2}
            label="Commission réglée"
            value={moneyMAD(summary?.commission_paid ?? 0, 2)}
            accent="neutral"
          />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard
            icon={Wallet}
            label="Total commissions"
            value={moneyMAD((summary?.commission_pending ?? 0) + (summary?.commission_paid ?? 0), 2)}
            accent="blue"
          />
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TripStatus | "")}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          className="form-select w-auto"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value as "" | "MA" | "CI")}
        >
          <option value="">Tous les pays</option>
          <option value="MA">Maroc</option>
          <option value="CI">Côte d'Ivoire</option>
        </select>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <div className="text-muted">Aucune course.</div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Trajet</th>
                <th>Distance</th>
                <th>Prix</th>
                <th>Commission</th>
                <th>Statut</th>
                <th>Commission</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="small">
                    🟠 {t.pickup_address} → 🟢 {t.dropoff_address}
                  </td>
                  <td className="small">{Number(t.distance_km).toFixed(2)} km</td>
                  <td className="small">{moneyMAD(Number(t.price), 2)}</td>
                  <td className="small">{moneyMAD(Number(t.commission_amount), 2)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.commission_status === "PAID" ? "bg-success" : "bg-warning text-dark"
                      }`}
                    >
                      {t.commission_status === "PAID" ? "Réglée" : "En attente"}
                    </span>
                  </td>
                  <td>
                    {t.status === "DELIVERED" && (
                      <button
                        type="button"
                        className="btn btn-outline-dark btn-sm"
                        disabled={busyId === t.id}
                        onClick={() => handleToggleCommission(t.id, t.commission_status)}
                      >
                        {busyId === t.id
                          ? "…"
                          : t.commission_status === "PAID"
                          ? "Marquer en attente"
                          : "Marquer réglée"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 ? (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="text-muted small">{total} course(s)</div>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Préc.
            </button>
            <span className="btn btn-sm btn-outline-dark disabled">
              {page} / {pages}
            </span>
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suiv.
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

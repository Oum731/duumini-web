// src/pages/MyCourierTripsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { useRealtime } from "../context/RealtimeContext";
import {
  listMyCourierTrips,
  cancelCourierTrip,
  courierTripErrorMessage,
  type CourierTrip,
  type TripStatus,
} from "../services/courierTrips";

const STATUS_LABEL: Record<TripStatus, string> = {
  REQUESTED: "En attente d'un livreur",
  ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const STATUS_COLOR: Record<TripStatus, string> = {
  REQUESTED: "text-bg-warning",
  ACCEPTED: "text-bg-info",
  IN_PROGRESS: "text-bg-primary",
  DELIVERED: "text-bg-success",
  CANCELLED: "text-bg-secondary",
};

export default function MyCourierTripsPage() {
  const { socket } = useRealtime();
  const [trips, setTrips] = useState<CourierTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listMyCourierTrips();
      setTrips(res.items);
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de charger vos courses."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Rafraîchit automatiquement la liste dès qu'une de nos courses change de
  // statut (acceptée/en cours/livrée/annulée), sans reload.
  useEffect(() => {
    if (!socket) return;
    function onStatus() {
      refresh();
    }
    socket.on("courier_trip_status", onStatus);
    return () => {
      socket.off("courier_trip_status", onStatus);
    };
  }, [socket]);

  async function handleCancel(id: number) {
    setCancellingId(id);
    try {
      await cancelCourierTrip(id);
      await refresh();
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible d'annuler cette course."));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="container-xxl py-5">
      <Seo
        title="Mes courses"
        description="Suivi de vos courses livreur DUUMINI."
        path="/mes-courses"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Mes courses
        </h1>
        <Link to="/courses/nouvelle" className="btn btn-duu-green">
          Nouvelle course
        </Link>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : trips.length === 0 ? (
        <div className="card border-0 shadow-sm p-4 text-center">
          <p className="text-muted mb-3">Vous n'avez encore réservé aucune course.</p>
          <Link to="/courses/nouvelle" className="btn btn-duu-green align-self-center">
            Commander un livreur
          </Link>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {trips.map((t) => (
            <div key={t.id} className="card border-0 shadow-sm p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <span className={`badge ${STATUS_COLOR[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
                <span className="fw-bold">{Number(t.price).toFixed(2)}</span>
              </div>
              <div className="small text-muted mb-1">
                🟠 {t.pickup_address} → 🟢 {t.dropoff_address}
              </div>
              <div className="small text-muted mb-2">
                {Number(t.distance_km).toFixed(2)} km · {t.payment_method}
              </div>
              <div className="d-flex gap-2">
                {(t.status === "ACCEPTED" || t.status === "IN_PROGRESS") && (
                  <Link
                    to={`/courses/${t.id}/suivi`}
                    className="btn btn-duu-green btn-sm align-self-start"
                  >
                    Suivre
                  </Link>
                )}
                {(t.status === "REQUESTED" || t.status === "ACCEPTED") && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm align-self-start"
                    disabled={cancellingId === t.id}
                    onClick={() => handleCancel(t.id)}
                  >
                    {cancellingId === t.id ? "Annulation…" : "Annuler"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

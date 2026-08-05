// src/pages/livreur/LivreurHome.tsx
import { useEffect, useRef, useState } from "react";
import { Seo } from "../../components/Seo";
import { LoadingState } from "../../components/ui/Spinner";
import EnableNotificationsButton from "../../components/EnableNotificationsButton";
import { moneyMAD } from "../../utils/money";
import {
  listAvailableCourierTrips,
  listMyCourierTrips,
  acceptCourierTrip,
  updateCourierTripStatus,
  updateTripPosition,
  courierTripErrorMessage,
  type CourierTrip,
  type TripStatus,
} from "../../services/courierTrips";
import {
  getMyLivreurProfile,
  updateMyPosition,
  updateMyAvailability,
  type MyLivreurProfile,
} from "../../services/livreurProfiles";

const AVAILABILITY_PING_MS = 60_000; // position basse fréquence tant qu'en ligne (matching)
const ACTIVE_TRIP_PING_MS = 7_000; // position live pendant une course active (suivi client)

const STATUS_LABEL: Record<TripStatus, string> = {
  REQUESTED: "En attente",
  ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

type Tab = "available" | "mine";

export default function LivreurHome() {
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<CourierTrip[]>([]);
  const [mine, setMine] = useState<CourierTrip[]>([]);
  const [profile, setProfile] = useState<MyLivreurProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [av, my, p] = await Promise.all([
        listAvailableCourierTrips(),
        listMyCourierTrips(),
        getMyLivreurProfile(),
      ]);
      setAvailable(av.items);
      setMine(my.items);
      setProfile(p);
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de charger vos courses."));
    } finally {
      setLoading(false);
    }
  }

  const canAccept = profile?.verification_status === "VALIDATED" && !profile?.is_blocked;
  const activeMine = mine.filter((t) => t.status === "ACCEPTED" || t.status === "IN_PROGRESS");
  const activeTripId = activeMine[0]?.id ?? null;

  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const lastActiveTripPingRef = useRef(0);

  useEffect(() => {
    refresh();
  }, []);

  async function handleToggleAvailability() {
    if (!profile) return;
    setAvailabilityBusy(true);
    try {
      const next = !profile.is_available;
      await updateMyAvailability(next);
      setProfile((p) => (p ? { ...p, is_available: next ? 1 : 0 } : p));
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de changer votre disponibilité."));
    } finally {
      setAvailabilityBusy(false);
    }
  }

  // Ping de position basse fréquence tant que le livreur est en ligne — sert
  // uniquement au matching de nouvelles courses proches (pas au suivi
  // d'une course active, géré par l'effet ci-dessous).
  useEffect(() => {
    if (!profile?.is_available || typeof navigator === "undefined" || !navigator.geolocation) return;

    function ping() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateMyPosition(pos.coords.latitude, pos.coords.longitude).catch(() => {});
          setGeoError(null);
        },
        () => setGeoError("Position indisponible — activez la géolocalisation pour recevoir des courses proches."),
        { timeout: 8000 }
      );
    }

    ping();
    const interval = setInterval(ping, AVAILABILITY_PING_MS);
    return () => clearInterval(interval);
  }, [profile?.is_available]);

  // Position live pendant une course active — alimente la carte de suivi du
  // client. Throttlée côté client (watchPosition peut déclencher très
  // souvent) via un timestamp, indépendamment du ping ci-dessus.
  useEffect(() => {
    if (!activeTripId || typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastActiveTripPingRef.current < ACTIVE_TRIP_PING_MS) return;
        lastActiveTripPingRef.current = now;
        updateTripPosition(activeTripId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
      },
      () => setGeoError("Position indisponible — le client ne peut pas suivre votre position en direct."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTripId]);

  async function handleAccept(id: number) {
    setBusyId(id);
    try {
      await acceptCourierTrip(id);
      await refresh();
      setTab("mine");
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Cette course n'est plus disponible."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvance(id: number, next: "IN_PROGRESS" | "DELIVERED") {
    setBusyId(id);
    try {
      await updateCourierTripStatus(id, next);
      await refresh();
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de mettre à jour cette course."));
    } finally {
      setBusyId(null);
    }
  }

  const delivered = mine.filter((t) => t.status === "DELIVERED");
  const earnings = delivered.reduce(
    (sum, t) => sum + (Number(t.price) - Number(t.commission_amount)),
    0
  );

  return (
    <section className="container-xxl py-5">
      <Seo
        title="Espace livreur"
        description="Acceptez des courses et suivez vos gains sur DUUMINI."
        path="/livreur"
      />
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Espace livreur
        </h1>
        {profile && (
          <button
            type="button"
            className={`btn btn-sm ${profile.is_available ? "btn-duu-green" : "btn-outline-secondary"}`}
            disabled={availabilityBusy}
            onClick={handleToggleAvailability}
          >
            {availabilityBusy
              ? "…"
              : profile.is_available
              ? "🟢 Disponible"
              : "⚪ Hors ligne"}
          </button>
        )}
      </div>

      {geoError && <div className="alert alert-warning py-2 small mb-3">{geoError}</div>}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <EnableNotificationsButton />
        <span className="small text-muted">
          Activez les notifications pour être alerté dès qu'une course est
          disponible près de vous.
        </span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Courses livrées</div>
            <div className="fw-bold fs-4">{delivered.length}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Mes gains (net)</div>
            <div className="fw-bold fs-4">{moneyMAD(earnings, 2)}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Courses en cours</div>
            <div className="fw-bold fs-4">{activeMine.length}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm p-3">
            <div className="text-muted small">Disponibles</div>
            <div className="fw-bold fs-4">{available.length}</div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {profile && profile.verification_status !== "VALIDATED" && (
        <div className="alert alert-warning">
          <strong>Compte en attente de validation.</strong> Rendez-vous à
          l'agence DUUMINI avec vos documents originaux (pièce d'identité)
          pour valider votre compte — vous ne pouvez pas encore accepter de
          courses.
        </div>
      )}

      {profile?.is_blocked ? (
        <div className="alert alert-danger">
          <strong>Compte bloqué.</strong> Vous devez {moneyMAD(profile.pending_commission, 2)}{" "}
          à DUUMINI. Réglez votre solde auprès de DUUMINI pour reprendre les
          courses.
        </div>
      ) : (
        profile && profile.pending_commission > 0 && (
          <div className="alert alert-secondary">
            Vous devez <strong>{moneyMAD(profile.pending_commission, 2)}</strong>{" "}
            à DUUMINI. Réglez votre solde avant <strong>dimanche 17h</strong>,
            sinon votre compte sera bloqué.
          </div>
        )
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === "available" ? "active" : ""}`}
            onClick={() => setTab("available")}
          >
            Courses disponibles
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === "mine" ? "active" : ""}`}
            onClick={() => setTab("mine")}
          >
            Mes courses
          </button>
        </li>
      </ul>

      {loading ? (
        <LoadingState label="Chargement…" />
      ) : tab === "available" ? (
        available.length === 0 ? (
          <p className="text-muted">Aucune course disponible pour le moment.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {available.map((t) => (
              <div key={t.id} className="card border-0 shadow-sm p-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <span className="fw-bold">{moneyMAD(Number(t.price), 2)}</span>
                  <span className="text-muted small">{Number(t.distance_km).toFixed(2)} km</span>
                </div>
                <div className="small text-muted mb-3">
                  🟠 {t.pickup_address} → 🟢 {t.dropoff_address}
                </div>
                <button
                  type="button"
                  className="btn btn-duu-green btn-sm align-self-start"
                  disabled={busyId === t.id || !canAccept}
                  onClick={() => handleAccept(t.id)}
                  title={!canAccept ? "Compte non validé ou bloqué" : undefined}
                >
                  {busyId === t.id ? "Acceptation…" : "Accepter cette course"}
                </button>
              </div>
            ))}
          </div>
        )
      ) : mine.length === 0 ? (
        <p className="text-muted">Vous n'avez encore accepté aucune course.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {mine.map((t) => (
            <div key={t.id} className="card border-0 shadow-sm p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <span className="badge text-bg-light border">{STATUS_LABEL[t.status]}</span>
                <span className="fw-bold">{moneyMAD(Number(t.price), 2)}</span>
              </div>
              <div className="small text-muted mb-2">
                🟠 {t.pickup_address} → 🟢 {t.dropoff_address}
              </div>
              <div className="small text-muted mb-3">
                {Number(t.distance_km).toFixed(2)} km · {t.payment_method}
              </div>
              {t.status === "ACCEPTED" && (
                <button
                  type="button"
                  className="btn btn-duu-orange btn-sm align-self-start"
                  disabled={busyId === t.id}
                  onClick={() => handleAdvance(t.id, "IN_PROGRESS")}
                >
                  {busyId === t.id ? "…" : "Démarrer la course"}
                </button>
              )}
              {t.status === "IN_PROGRESS" && (
                <button
                  type="button"
                  className="btn btn-duu-green btn-sm align-self-start"
                  disabled={busyId === t.id}
                  onClick={() => handleAdvance(t.id, "DELIVERED")}
                >
                  {busyId === t.id ? "…" : "Marquer comme livrée"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

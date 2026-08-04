// src/pages/CourierTripTrackingPage.tsx
// Suivi client en temps réel d'une course : carte live (position du
// livreur diffusée via WS) + timeline de statut. Les événements
// "courier_trip_position"/"courier_trip_status" sont émis directement par
// le backend (emitToUsers), indépendamment du canal générique "notify"
// (toast/push) déjà géré par RealtimeContext.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Seo } from "../components/Seo";
import { LoadingState } from "../components/ui/Spinner";
import { moneyMAD } from "../utils/money";
import { useRealtime } from "../context/RealtimeContext";
import {
  getCourierTrip,
  cancelCourierTrip,
  courierTripErrorMessage,
  type CourierTrip,
  type TripStatus,
} from "../services/courierTrips";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const LIVREUR_ICON = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:var(--duu-orange,#f57c00);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const STATUS_STEPS: TripStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "DELIVERED"];
const STATUS_LABEL: Record<TripStatus, string> = {
  REQUESTED: "En attente d'un livreur",
  ACCEPTED: "Livreur en route",
  IN_PROGRESS: "Course en cours",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export default function CourierTripTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id) || 0;
  const navigate = useNavigate();
  const { socket } = useRealtime();

  const [trip, setTrip] = useState<CourierTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [livreurPos, setLivreurPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const t = await getCourierTrip(tripId);
        if (cancelled) return;
        setTrip(t);
        if (t.livreur_lat && t.livreur_lng) {
          setLivreurPos([Number(t.livreur_lat), Number(t.livreur_lng)]);
        }
      } catch (e: any) {
        if (!cancelled) setError(courierTripErrorMessage(e, "Impossible de charger cette course."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useEffect(() => {
    if (!socket || !tripId) return;

    function onPosition(data: any) {
      if (Number(data?.trip_id) !== tripId) return;
      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLivreurPos([lat, lng]);
      }
    }

    function onStatus(data: any) {
      if (Number(data?.trip_id) !== tripId) return;
      setTrip((prev) => (prev ? { ...prev, status: data.status } : prev));
    }

    socket.on("courier_trip_position", onPosition);
    socket.on("courier_trip_status", onStatus);
    return () => {
      socket.off("courier_trip_position", onPosition);
      socket.off("courier_trip_status", onStatus);
    };
  }, [socket, tripId]);

  async function handleCancel() {
    if (!trip) return;
    setCancelling(true);
    try {
      await cancelCourierTrip(trip.id);
      navigate("/mes-courses");
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible d'annuler cette course."));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <section className="container-xxl py-5">
        <LoadingState label="Chargement…" />
      </section>
    );
  }

  if (error && !trip) {
    return (
      <section className="container-xxl py-5">
        <div className="alert alert-danger py-2">{error}</div>
      </section>
    );
  }

  if (!trip) return null;

  const pickup: [number, number] = [Number(trip.pickup_lat), Number(trip.pickup_lng)];
  const dropoff: [number, number] = [Number(trip.dropoff_lat), Number(trip.dropoff_lng)];
  const center = livreurPos || pickup;
  const currentStepIndex = STATUS_STEPS.indexOf(trip.status);

  return (
    <section className="container-xxl py-5">
      <Seo
        title="Suivi de ma course"
        description="Suivi en temps réel de votre course livreur DUUMINI."
        path={`/courses/${trip.id}/suivi`}
      />
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Suivi de ma course
        </h1>
        <span className="fw-bold">{moneyMAD(Number(trip.price), 2)}</span>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {trip.status === "CANCELLED" ? (
        <div className="alert alert-secondary">Cette course a été annulée.</div>
      ) : (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {STATUS_STEPS.map((s, i) => (
            <span
              key={s}
              className={`badge ${i <= currentStepIndex ? "bg-success" : "bg-light text-muted border"}`}
            >
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      )}

      <div
        className="rounded-4 overflow-hidden mb-3"
        style={{ height: 380, border: "1px solid rgba(0,0,0,.1)" }}
      >
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={pickup} />
          <Marker position={dropoff} />
          <Polyline positions={[pickup, dropoff]} pathOptions={{ color: "var(--duu-orange)", dashArray: "6 8" }} />
          {livreurPos && <Marker position={livreurPos} icon={LIVREUR_ICON} />}
        </MapContainer>
      </div>

      <div className="card border-0 shadow-sm p-3 mb-3">
        <div className="small text-muted mb-1">
          🟠 {trip.pickup_address} → 🟢 {trip.dropoff_address}
        </div>
        <div className="small text-muted">
          {Number(trip.distance_km).toFixed(2)} km · {trip.payment_method}
        </div>
        {!livreurPos && (trip.status === "ACCEPTED" || trip.status === "IN_PROGRESS") && (
          <div className="small text-muted mt-2">
            Position du livreur pas encore disponible — elle apparaîtra dès qu'il la partage.
          </div>
        )}
      </div>

      {(trip.status === "REQUESTED" || trip.status === "ACCEPTED") && (
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={cancelling}
          onClick={handleCancel}
        >
          {cancelling ? "Annulation…" : "Annuler la course"}
        </button>
      )}
    </section>
  );
}

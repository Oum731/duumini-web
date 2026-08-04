// src/components/TripMapPicker.tsx
// Carte gratuite (Leaflet + OpenStreetMap, aucune clé API) pour placer un
// point de départ et un point d'arrivée. Distance calculée à vol d'oiseau
// (formule de Haversine) — le serveur refait ce calcul et fait foi, ceci
// n'est qu'une estimation affichée en direct.
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { TripType } from "../services/courierTrips";

// Correctif classique Leaflet + bundlers (Vite/webpack) : les chemins
// d'icônes par défaut ne se résolvent pas sans ceci.
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Mêmes constantes que duumini-api/src/routes/courierTrips.js — à garder
// synchronisées ; le prix affiché ici n'est qu'une estimation, le serveur
// recalcule et fait foi.
const MAX_DISTANCE_KM = 15;
const SHOPPING_BOOST = 0.35;
const PRICE_RANGES = {
  NORMAL: { low: 10, high: 30 },
  HEAVY: { low: 50, high: 100 },
};

function computePrice(distanceKm: number, isHeavy: boolean, tripType: TripType) {
  const range = isHeavy ? PRICE_RANGES.HEAVY : PRICE_RANGES.NORMAL;
  const ratio = Math.min(
    1,
    distanceKm / MAX_DISTANCE_KM + (tripType === "SHOPPING" ? SHOPPING_BOOST : 0)
  );
  return Math.round((range.low + (range.high - range.low) * ratio) * 100) / 100;
}

const DEFAULT_CENTER: [number, number] = [33.5731, -7.5898]; // Casablanca

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TripMapValue = {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  price: number;
};

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function TripMapPicker({
  onChange,
  tripType,
  isHeavy,
}: {
  onChange: (value: TripMapValue) => void;
  tripType: TripType;
  isHeavy: boolean;
}) {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<[number, number]>(DEFAULT_CENTER);
  const [dropoff, setDropoff] = useState<[number, number]>([
    DEFAULT_CENTER[0] + 0.01,
    DEFAULT_CENTER[1] + 0.01,
  ]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(here);
        setPickup(here);
      },
      () => {},
      { timeout: 5000 }
    );
  }, []);

  const { distanceKm, price } = useMemo(() => {
    const d = haversineKm(pickup[0], pickup[1], dropoff[0], dropoff[1]);
    const rounded = Math.round(d * 100) / 100;
    return { distanceKm: rounded, price: computePrice(rounded, isHeavy, tripType) };
  }, [pickup, dropoff, isHeavy, tripType]);

  useEffect(() => {
    onChange({
      pickupLat: pickup[0],
      pickupLng: pickup[1],
      dropoffLat: dropoff[0],
      dropoffLng: dropoff[1],
      distanceKm,
      price,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, distanceKm, price]);

  return (
    <div>
      <div
        className="rounded-4 overflow-hidden mb-2"
        style={{ height: 320, border: "1px solid rgba(0,0,0,.1)" }}
      >
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <Recenter center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={pickup}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                setPickup([p.lat, p.lng]);
              },
            }}
          />
          <Marker
            position={dropoff}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                setDropoff([p.lat, p.lng]);
              },
            }}
          />
          <Polyline positions={[pickup, dropoff]} pathOptions={{ color: "var(--duu-orange)", dashArray: "6 8" }} />
        </MapContainer>
      </div>

      <div className="d-flex flex-wrap gap-2 small text-muted mb-1">
        <span>🟠 Faites glisser les repères pour placer le départ et l'arrivée.</span>
      </div>

      <div className="d-flex flex-wrap gap-3">
        <div>
          <span className="text-muted small">Distance estimée</span>
          <div className="fw-bold">{distanceKm.toFixed(2)} km</div>
        </div>
        <div>
          <span className="text-muted small">Prix estimé</span>
          <div className="fw-bold">{price.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// src/pages/CourierBookingPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import TripMapPicker, { type TripMapValue } from "../components/TripMapPicker";
import { useAuth } from "../context/AuthContext";
import type { PaymentMethod } from "./checkout/types";
import {
  createCourierTrip,
  courierTripErrorMessage,
  type TripType,
} from "../services/courierTrips";

export default function CourierBookingPage() {
  const { user } = useAuth();

  const [mapValue, setMapValue] = useState<TripMapValue | null>(null);
  const [tripType, setTripType] = useState<TripType>("PICKUP");
  const [isHeavy, setIsHeavy] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [phone, setPhone] = useState(user?.phone || "");
  const [countryCode, setCountryCode] = useState<"MA" | "CI">("MA");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mapValue) {
      setError("Placez les repères de départ et d'arrivée sur la carte.");
      return;
    }
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setError("Indiquez une adresse de départ et d'arrivée.");
      return;
    }
    if (!phone.trim()) {
      setError("Numéro de téléphone requis.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createCourierTrip({
        pickup_address: pickupAddress.trim(),
        pickup_lat: mapValue.pickupLat,
        pickup_lng: mapValue.pickupLng,
        dropoff_address: dropoffAddress.trim(),
        dropoff_lat: mapValue.dropoffLat,
        dropoff_lng: mapValue.dropoffLng,
        package_description: packageDescription.trim() || null,
        trip_type: tripType,
        is_heavy_package: isHeavy,
        payment_method: paymentMethod,
        country_code: countryCode,
        requester_phone: phone.trim(),
        requester_name: user?.first_name || null,
      });
      setDone(true);
    } catch (e: any) {
      setError(courierTripErrorMessage(e, "Impossible de réserver la course."));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="container-xxl py-5" style={{ maxWidth: 640 }}>
        <div className="card border-0 shadow-sm p-4 text-center">
          <h1 className="h4 mb-3" style={{ color: "var(--duu-green)" }}>
            Course réservée
          </h1>
          <p className="text-muted mb-4">
            Un livreur disponible peut maintenant l'accepter. Suivez son
            avancement depuis "Mes courses".
          </p>
          <div className="d-flex gap-2 justify-content-center">
            <Link to="/mes-courses" className="btn btn-duu-green">
              Mes courses
            </Link>
            <Link to="/" className="btn btn-outline-dark">
              Accueil
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container-xxl py-5" style={{ maxWidth: 720 }}>
      <Seo
        title="Commander un livreur"
        description="Réservez un livreur DUUMINI pour transporter un colis d'un point A à un point B."
        path="/courses/nouvelle"
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Commander un livreur
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <p className="text-muted mb-4">
        Placez le départ et l'arrivée sur la carte, le prix est calculé selon
        la distance.
      </p>

      <form onSubmit={handleSubmit} className="card border-0 shadow-sm p-4">
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="mb-3">
          <label className="form-label d-block">Type de course</label>
          <div className="row g-2">
            <div className="col-12 col-sm-6">
              <label
                className={`d-flex align-items-start gap-2 p-3 border rounded-3 ${
                  tripType === "PICKUP" ? "border-dark" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="trip_type"
                  className="form-check-input mt-1"
                  checked={tripType === "PICKUP"}
                  onChange={() => setTripType("PICKUP")}
                />
                <span>
                  <span className="fw-semibold d-block">Récupérer un colis</span>
                  <span className="text-muted small">
                    Le colis est déjà prêt, le livreur le récupère et le livre.
                  </span>
                </span>
              </label>
            </div>
            <div className="col-12 col-sm-6">
              <label
                className={`d-flex align-items-start gap-2 p-3 border rounded-3 ${
                  tripType === "SHOPPING" ? "border-dark" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="trip_type"
                  className="form-check-input mt-1"
                  checked={tripType === "SHOPPING"}
                  onChange={() => setTripType("SHOPPING")}
                />
                <span>
                  <span className="fw-semibold d-block">Acheter puis livrer</span>
                  <span className="text-muted small">
                    Le livreur doit d'abord trouver/acheter le produit — tarif
                    plus élevé pour le temps passé.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="is-heavy-package"
            checked={isHeavy}
            onChange={(e) => setIsHeavy(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="is-heavy-package">
            Le colis pèse plus de 30 kg
          </label>
        </div>

        <TripMapPicker onChange={setMapValue} tripType={tripType} isHeavy={isHeavy} />

        <div className="row g-3 mt-1">
          <div className="col-12 col-sm-6">
            <label className="form-label">Adresse de départ</label>
            <input
              className="form-control"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Ex. 12 rue des Fleurs, quartier..."
              required
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Adresse d'arrivée</label>
            <input
              className="form-control"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="Ex. 45 avenue Centrale..."
              required
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Pays</label>
            <select
              className="form-select"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as "MA" | "CI")}
            >
              <option value="MA">Maroc</option>
              <option value="CI">Côte d'Ivoire</option>
            </select>
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Téléphone</label>
            <input
              className="form-control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6 00 00 00 00"
              required
            />
          </div>

          <div className="col-12">
            <label className="form-label">Description du colis (optionnel)</label>
            <textarea
              className="form-control"
              rows={2}
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
              placeholder="Ex. enveloppe, petit carton..."
            />
          </div>

          <div className="col-12 col-sm-6">
            <label className="form-label">Mode de paiement</label>
            <select
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="CASH">CASH</option>
              <option value="BMCE">BMCE</option>
              <option value="GAZHALA">GAZHALA</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-duu-green mt-4" disabled={submitting}>
          {submitting ? "Réservation…" : "Réserver la course"}
        </button>
      </form>
    </section>
  );
}

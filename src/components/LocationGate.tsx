// src/components/LocationGate.tsx
import { useEffect, useState } from "react";
import {
  useLocationCity,
  CITY_OPTIONS,
  type CityCode,
} from "../context/LocationContext";

export default function LocationGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { city, setCity, isReady } = useLocationCity();
  const [showModal, setShowModal] = useState(false);

  // 👉 Label courant (si besoin plus tard)

  // 👉 Au premier chargement : si pas de ville, on force l'ouverture
  useEffect(() => {
    if (!isReady) return;
    if (!city) {
      setShowModal(true);
    }
  }, [isReady, city]);

  // 👉 Écoute un évènement global "city:open" pour ouvrir depuis ailleurs si besoin
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener("city:open", handler);
    return () => window.removeEventListener("city:open", handler);
  }, []);

  function handleSelect(c: CityCode) {
    setCity(c);
    setShowModal(false);
  }

  if (!isReady) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center text-muted small">
          Chargement de votre zone de livraison…
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 🌍 Contenu normal de l'app */}
      {children}

      {/* 📍 Bouton flottant PROPRE, en bas à GAUCHE pour ne pas gêner le panier */}
      {!showModal && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="position-fixed d-inline-flex align-items-center gap-2 shadow-sm"
          style={{
            left: 16,              // ✅ plus à droite → on passe à gauche
            bottom: 16,
            zIndex: 1050,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.06)",
            background: "#FFD54F",
            padding: "8px 14px",
            fontSize: ".85rem",
            color: "var(--duu-black, #111)",
          }}
          aria-label="Changer ma ville de livraison"
        >
          <span style={{ fontSize: "1rem" }}>📍</span>
          <span className="fw-semibold">Changer ma ville</span>
        </button>
      )}

      {/* 🟡 Modal de sélection de ville */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div
                  className="modal-header"
                  style={{
                    borderBottomColor: "rgba(0,0,0,.06)",
                    background: "rgba(255,213,79,0.15)",
                  }}
                >
                  <h5 className="modal-title d-flex align-items-center gap-2">
                    <span>📍</span>
                    <span>Choisissez votre ville</span>
                  </h5>
                  <button
                    className="btn-close"
                    aria-label="Fermer"
                    onClick={() => setShowModal(false)}
                  />
                </div>

                <div className="modal-body">
                  <p className="small text-muted">
                    Veuillez sélectionner votre ville. Ce choix sera utilisé
                    pour filtrer les restaurants, plats et produits affichés.
                  </p>

                  <div className="d-flex flex-column gap-2 mt-3">
                    {CITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        className="btn w-100"
                        onClick={() => handleSelect(opt.code)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,.08)",
                          background:
                            opt.code === city
                              ? "var(--duu-yellow, #FFD54F)"
                              : "#fff",
                          color: "var(--duu-black, #111)",
                          fontWeight: 600,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <p className="small text-muted mt-3 mb-0">
                    La ville sélectionnée reste active même si vous êtes
                    connecté(e). Elle remplace celle enregistrée dans votre
                    profil pour l’affichage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

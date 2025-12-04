// src/components/LocationGate.tsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
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
  const { user } = useAuth();
  const { city, setCity, isReady } = useLocationCity();
  const [showModal, setShowModal] = useState(false);

  // Label lisible de la ville courante (pour le petit bouton flottant)
  const currentCityLabel =
    CITY_OPTIONS.find((c) => c.code === city)?.label || "Choisir ma ville";

  // Quand le contexte est prêt :
  // - si user connecté → on laisse passer (la ville vient de son profil)
  // - si invité & aucune ville → on ouvre le modal une première fois
  useEffect(() => {
    if (!isReady) return;

    if (user) {
      setShowModal(false);
      return;
    }

    if (!city) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [user?.id, isReady, city]);

  function handleSelect(c: CityCode) {
    setCity(c);
    setShowModal(false);
  }

  function reopenModal() {
    // Invité uniquement
    if (!user) {
      setShowModal(true);
    }
  }

  // On attend d'avoir lu le localStorage / profil avant d'afficher l'app
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
      {/* Contenu normal du site */}
      {children}

      {/* 🔁 Bouton flottant pour changer de ville (INVITÉ uniquement) */}
      {!user && (
        <button
          type="button"
          onClick={reopenModal}
          className="position-fixed d-inline-flex align-items-center gap-1 shadow-sm"
          style={{
            right: 16,
            bottom: 16,
            zIndex: 1040,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.08)",
            background: "#fff",
            padding: "8px 14px",
            fontSize: ".85rem",
            color: "var(--duu-black, #111)",
          }}
        >
          <span style={{ fontSize: "1rem" }}>📍</span>
          <span className="fw-semibold">{currentCityLabel}</span>
          <span
            className="text-muted"
            style={{ fontSize: ".75rem", marginLeft: 4 }}
          >
            – changer
          </span>
        </button>
      )}

      {/* 🟡 Modal de sélection (invité) */}
      {!user && showModal && (
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
                    background: "rgba(255,213,79,0.15)", // léger jaune
                  }}
                >
                  <h5 className="modal-title d-flex align-items-center gap-2">
                    <span>📍</span>
                    <span>Choisissez votre ville</span>
                  </h5>
                </div>
                <div className="modal-body">
                  <p className="small text-muted">
                    Pour vous proposer les bons produits et la bonne livraison,
                    indiquez votre ville :
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
                          color:
                            opt.code === city
                              ? "var(--duu-black, #111)"
                              : "var(--duu-black, #111)",
                          fontWeight: 600,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <p className="small text-muted mt-3 mb-0">
                    Ce choix est mémorisé sur cet appareil. Vous pourrez le
                    modifier à tout moment via le bouton{" "}
                    <strong>📍 {currentCityLabel}</strong> en bas à droite.
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

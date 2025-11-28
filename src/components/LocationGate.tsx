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

  // User connecté → on ne bloque jamais (même si city null)
  useEffect(() => {
    if (!isReady) return;

    if (user) {
      setShowModal(false);
      return;
    }

    // Invité : si aucune ville en mémoire → on affiche une seule fois
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

  // On attend d'avoir lu localStorage / profil avant d'afficher l'app
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
      {children}
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
                <div className="modal-header">
                  <h5 className="modal-title">Choisissez votre ville</h5>
                </div>
                <div className="modal-body">
                  <p className="small text-muted">
                    Pour vous proposer les bons produits et la bonne livraison,
                    indiquez votre ville :
                  </p>
                  <div className="d-flex flex-column gap-2">
                    {CITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        className="btn btn-outline-dark w-100"
                        onClick={() => handleSelect(opt.code)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="small text-muted mt-3 mb-0">
                    Ce choix est mémorisé sur cet appareil. Vous pourrez le
                    changer plus tard depuis le site si besoin.
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

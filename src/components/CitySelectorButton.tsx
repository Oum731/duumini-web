import { useState } from "react";
import {
  CITY_OPTIONS,
  useLocationCity,
  type CityCode,
} from "../context/LocationContext";

export default function CitySelectorButton() {
  const { city, setCity } = useLocationCity();
  const [show, setShow] = useState(false);

  const currentLabel =
    CITY_OPTIONS.find((c) => c.code === city)?.label || "Ville";

  function handleSelect(c: CityCode) {
    setCity(c);
    setShow(false);
  }

  return (
    <>
      {/* 🔘 Bouton dans la Navbar */}
      <button
        className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
        onClick={() => setShow(true)}
      >
        <span>📍</span>
        <span>{currentLabel}</span>
      </button>

      {/* 🟡 Modal sélection */}
      {show && (
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
                  <h5 className="modal-title">📍 Choisissez votre ville</h5>
                  <button
                    className="btn-close"
                    aria-label="Fermer"
                    onClick={() => setShow(false)}
                  />
                </div>

                <div className="modal-body">
                  <div className="d-flex flex-column gap-2 mt-2">
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
                    Le choix reste actif même si vous êtes connecté(e).
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

// src/pages/home/PersonasSection.tsx
import { Link } from "react-router-dom";
import { PERSONAS } from "./data";

export default function PersonasSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <h2 className="dz-display fw-semibold mb-1" style={{ color: "var(--dz-ink)" }}>
        Choisissez votre profil
      </h2>
      <p className="mb-4" style={{ maxWidth: 560, color: "var(--dz-ink-muted)" }}>
        DUUMINI s'adapte à qui vous êtes : chaque profil a son propre parcours.
      </p>

      <div className="row g-3">
        {PERSONAS.map((p) => {
          const iconBg =
            p.tint === "orange"
              ? "rgba(var(--duu-orange-rgb), .14)"
              : "rgba(var(--duu-green-rgb), .14)";
          const iconColor = p.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";

          return (
            <div className="col-6 col-lg-3" key={p.key}>
              <Link
                to={p.href ?? `/solutions/${p.key}`}
                className="dz-card d-block h-100 text-decoration-none"
                style={{ transition: "transform .15s ease, box-shadow .15s ease" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "var(--dz-shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--dz-shadow-sm)";
                }}
              >
                <div className="p-3 p-md-4 h-100 d-flex flex-column">
                  <div
                    className="d-flex align-items-center justify-content-center mb-3"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: iconBg,
                      fontSize: "1.5rem",
                    }}
                    aria-hidden="true"
                  >
                    {p.emoji}
                  </div>

                  <div className="fw-bold mb-1" style={{ color: "var(--duu-black)" }}>
                    Je suis {p.title.toLowerCase()}
                  </div>
                  <div className="text-muted small flex-grow-1">{p.description}</div>
                  <div
                    className="small fw-semibold mt-2"
                    style={{ color: iconColor }}
                  >
                    En savoir plus →
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

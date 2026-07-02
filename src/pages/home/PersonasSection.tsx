// src/pages/home/PersonasSection.tsx
import { Link } from "react-router-dom";
import { PERSONAS, type Persona } from "./data";

// Isolé pour pouvoir être remplacé par une vraie photo de marque plus tard
// sans toucher à la mise en page de la carte.
function PersonaVisual({ persona }: { persona: Persona }) {
  return (
    <img
      src={persona.photo}
      alt={persona.title}
      className="d-none d-md-block flex-shrink-0"
      style={{
        width: 90,
        height: 90,
        objectFit: "cover",
        borderRadius: "var(--duu-radius-md)",
      }}
      loading="lazy"
    />
  );
}

export default function PersonasSection() {
  return (
    <section className="container-xxl py-5">
      <h2 className="fw-bold mb-4">Pour qui ?</h2>

      <div className="d-flex flex-column gap-3">
        {PERSONAS.map((p) => {
          const Icon = p.icon;
          const iconBg =
            p.tint === "orange"
              ? "rgba(var(--duu-orange-rgb), .14)"
              : "rgba(var(--duu-green-rgb), .14)";
          const iconColor = p.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";

          return (
            <div
              className="row align-items-center g-3 p-3 p-md-4 mx-0"
              key={p.key}
              style={{
                borderRadius: "var(--duu-radius-lg)",
                background: p.key === "diaspora" ? "rgba(var(--duu-orange-rgb), .06)" : "#fff",
                boxShadow: "var(--duu-shadow-sm)",
              }}
            >
              <div className="col-auto">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: iconBg,
                  }}
                >
                  <Icon size={24} color={iconColor} />
                </div>
              </div>

              <div className="col">
                <div className="fw-bold mb-1">{p.title}</div>
                <div className="text-muted small mb-1">{p.description}</div>
                <Link
                  to={`/solutions#${p.key}`}
                  className="small fw-semibold text-decoration-none"
                >
                  En savoir plus →
                </Link>
              </div>

              <div className="col-auto">
                <PersonaVisual persona={p} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

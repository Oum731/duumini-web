// src/pages/SolutionsPage.tsx
import { Link } from "react-router-dom";
import { PERSONAS } from "./home/data";

export default function SolutionsPage() {
  return (
    <section className="container-xxl py-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0" style={{ color: "var(--duu-green)" }}>
          Solutions
        </h1>
        <Link to="/" className="btn btn-outline-dark">
          Accueil
        </Link>
      </div>

      <p className="text-muted mb-5" style={{ maxWidth: 640 }}>
        Quel que soit votre profil, DUUMINI propose une solution concrète pour
        acheter, vendre ou vous approvisionner à travers l'Afrique.
      </p>

      <div className="d-flex flex-column gap-5">
        {PERSONAS.map((p) => {
          const Icon = p.icon;
          const color = p.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";
          const bg =
            p.tint === "orange"
              ? "rgba(var(--duu-orange-rgb), .12)"
              : "rgba(var(--duu-green-rgb), .12)";

          return (
            <div id={p.key} key={p.key} style={{ scrollMarginTop: 90 }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div
                  className="d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 56, height: 56, borderRadius: "50%", background: bg }}
                >
                  <Icon size={26} color={color} />
                </div>
                <h2 className="h4 m-0" style={{ color }}>
                  {p.title}
                </h2>
              </div>

              {p.detail.map((paragraph, i) => (
                <p className="text-muted" key={i} style={{ maxWidth: 720 }}>
                  {paragraph}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

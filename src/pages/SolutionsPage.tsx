// src/pages/SolutionsPage.tsx
import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { PERSONAS } from "./home/data";

export default function SolutionsPage() {
  return (
    <section className="container-xxl py-5">
      <Seo
        title="Nos solutions"
        description="Fournisseur, revendeur, client ou partenaire : découvrez la solution DUUMINI adaptée à votre profil pour acheter, vendre ou vous approvisionner en Afrique."
        path="/solutions"
      />
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

      <div className="row g-3">
        {PERSONAS.map((p) => {
          const color = p.tint === "orange" ? "var(--duu-orange)" : "var(--duu-green)";
          const bg =
            p.tint === "orange"
              ? "rgba(var(--duu-orange-rgb), .12)"
              : "rgba(var(--duu-green-rgb), .12)";

          return (
            <div className="col-12 col-md-6" key={p.key}>
              <Link
                to={p.href ?? `/solutions/${p.key}`}
                className="d-block h-100 text-decoration-none p-4"
                style={{
                  borderRadius: "var(--duu-radius-lg)",
                  background: "#fff",
                  boxShadow: "var(--duu-shadow-sm)",
                  color: "var(--duu-black)",
                }}
              >
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 52, height: 52, borderRadius: "50%", background: bg, fontSize: "1.4rem" }}
                    aria-hidden="true"
                  >
                    {p.emoji}
                  </div>
                  <h2 className="h5 m-0" style={{ color }}>
                    {p.title}
                  </h2>
                </div>
                <p className="text-muted mb-2">{p.description}</p>
                <span className="small fw-semibold" style={{ color }}>
                  Découvrir la solution →
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

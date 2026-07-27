// src/pages/home/FinalCtaSection.tsx
import { Link } from "react-router-dom";

export default function FinalCtaSection() {
  return (
    <section className="container-xxl py-4 py-md-5">
      <div
        className="text-center p-4 p-md-5"
        style={{
          borderRadius: "var(--duu-radius-xl)",
          background: "var(--duu-yellow)",
        }}
      >
        <h2 className="fw-bold mb-2" style={{ color: "#1f1f1f" }}>
          Rejoignez DUUMINI
        </h2>
        <p className="mb-4" style={{ color: "#1f1f1f", opacity: 0.85 }}>
          Fournisseur, revendeur, client ou partenaire : votre profil, votre
          parcours.
        </p>
        <Link to="/rejoindre" className="btn btn-dark btn-lg">
          Rejoindre DUUMINI
        </Link>
      </div>
    </section>
  );
}
